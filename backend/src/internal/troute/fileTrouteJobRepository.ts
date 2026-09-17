import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  trouteErrorPayloadSchema,
  trouteJobStatusSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  trouteProgressStageSchema,
  type TrouteErrorPayload,
  type TrouteJobState,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { z } from 'zod';
import {
  TrouteJobRepository,
  TrouteJobRepositoryError,
  type StoredTrouteJob,
} from './trouteJobRepository.js';

const persistedStateSchema = z.strictObject({
  job_id: z.string(),
  status: trouteJobStatusSchema,
  stage: trouteProgressStageSchema.nullable(),
  progress: z.number().int().min(0).max(100),
  last_message: z.string().nullable(),
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
  completed_at: z.number().int().nonnegative().nullable(),
  last_synced_at: z.number().int().nonnegative().nullable().optional(),
  last_event_id: z.string().nullable().optional(),
  last_sequence: z.number().int().nonnegative().nullable().optional(),
  diagnostic: z.unknown().optional(),
});

type FileTrouteJobRepositoryOptions = {
  rootDir: string;
  clock?: () => number;
};

export class FileTrouteJobRepository extends TrouteJobRepository {
  public constructor(options: FileTrouteJobRepositoryOptions) {
    super(options.clock);
    this.rootDir = resolve(options.rootDir);
    this.jobsDir = join(this.rootDir, 'troute-jobs');
    this.indexPath = join(this.rootDir, 'troute-jobs-index.json');
    mkdirSync(this.jobsDir, { recursive: true });
    this.restoreJobs();
  }

  protected override persistCreated(job: StoredTrouteJob): void {
    if (job.request === null) {
      throw new TrouteJobRepositoryError(
        'invalid_job_id',
        'Persistent troute jobs require the optimize request.',
      );
    }

    const jobDir = this.jobDirectory(job.state.job_id);
    if (existsSync(jobDir)) {
      throw new TrouteJobRepositoryError(
        'job_already_exists',
        'The troute job already exists on disk.',
      );
    }

    mkdirSync(jobDir);
    this.writeJsonAtomic(join(jobDir, 'request.json'), job.request);
    this.writeState(job);
  }

  protected override persistRemoteMirror(
    job: StoredTrouteJob,
    isNew: boolean,
  ): void {
    if (job.request === null) {
      throw new TrouteJobRepositoryError(
        'invalid_job_id',
        'Persistent troute jobs require the optimize request.',
      );
    }

    const jobDir = this.jobDirectory(job.state.job_id);
    if (isNew) {
      if (existsSync(jobDir)) {
        throw new TrouteJobRepositoryError(
          'job_already_exists',
          'The troute job already exists on disk.',
        );
      }
      mkdirSync(jobDir);
    }
    this.writeJsonAtomic(join(jobDir, 'request.json'), job.request);
    if (job.state.result !== null) {
      this.writeJsonAtomic(join(jobDir, 'result.json'), job.state.result);
    }
    if (job.state.error !== null) {
      this.writeJsonAtomic(join(jobDir, 'error.json'), job.state.error);
    }
    this.writeState(job);
    if (job.state.result === null) {
      this.removeFileIfPresent(join(jobDir, 'result.json'));
    }
    if (job.state.error === null) {
      this.removeFileIfPresent(join(jobDir, 'error.json'));
    }
  }

  protected override persistGatewayFailure(
    job: StoredTrouteJob,
    error: TrouteErrorPayload,
  ): void {
    this.writeJsonAtomic(
      join(this.jobDirectory(job.state.job_id), 'error.json'),
      error,
    );
    this.writeState(job);
  }

  protected override persistJobIndex(): void {
    const jobs = this.listRecent(Number.MAX_SAFE_INTEGER).map((job) => ({
      job_id: job.state.job_id,
      status: job.state.status,
      created_at: job.created_at,
      updated_at: job.updated_at,
    }));
    this.writeJsonAtomic(this.indexPath, { jobs });
  }

  private readonly rootDir: string;
  private readonly jobsDir: string;
  private readonly indexPath: string;
  private temporaryFileSequence = 0;

  private restoreJobs(): void {
    for (const entry of readdirSync(this.jobsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const jobDir = join(this.jobsDir, entry.name);
      try {
        const storedJob = this.readStoredJob(jobDir);
        this.restore(storedJob);
        this.writeState(storedJob);
      } catch (cause) {
        console.error('로컬 troute Job을 복구하지 못했습니다.', {
          directory: jobDir,
          cause,
        });
      }
    }
    this.persistJobIndex();
  }

  private readStoredJob(jobDir: string): StoredTrouteJob {
    const request = trouteOptimizeRequestSchema.parse(
      this.readJson(join(jobDir, 'request.json')),
    );
    const persisted = persistedStateSchema.parse(
      this.readJson(join(jobDir, 'state.json')),
    );
    if (persisted.job_id !== request.job_id) {
      throw new Error('request.json과 state.json의 job_id가 다릅니다.');
    }

    const result = this.readOptionalResult(join(jobDir, 'result.json'));
    const error = this.readOptionalError(join(jobDir, 'error.json'));
    const recoveredStatus =
      result !== null &&
      persisted.last_synced_at === undefined &&
      (persisted.status === 'pending' || persisted.status === 'running')
        ? 'completed'
        : persisted.status;
    const state: TrouteJobState = {
      job_id: request.job_id,
      status: recoveredStatus,
      stage: persisted.stage,
      progress: recoveredStatus === 'completed' ? 100 : persisted.progress,
      last_message: persisted.last_message,
      error: recoveredStatus === 'failed' ? error : null,
      result: recoveredStatus === 'completed' ? result : null,
    };

    return {
      request,
      state,
      createdAt: persisted.created_at,
      updatedAt: persisted.updated_at,
      completedAt:
        recoveredStatus === 'completed'
          ? (persisted.completed_at ?? persisted.updated_at)
          : persisted.completed_at,
      lastSyncedAt: persisted.last_synced_at ?? null,
      lastEventId: persisted.last_event_id ?? null,
      lastEventSequence: persisted.last_sequence ?? null,
    };
  }

  private readOptionalResult(path: string): TrouteOptimizeResponse | null {
    return existsSync(path)
      ? trouteOptimizeResponseSchema.parse(this.readJson(path))
      : null;
  }

  private readOptionalError(path: string): TrouteErrorPayload | null {
    return existsSync(path)
      ? trouteErrorPayloadSchema.parse(this.readJson(path))
      : null;
  }

  private readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  }

  private writeState(job: StoredTrouteJob): void {
    const state = {
      job_id: job.state.job_id,
      status: job.state.status,
      stage: job.state.stage,
      progress: job.state.progress,
      last_message: job.state.last_message,
      created_at: job.createdAt,
      updated_at: job.updatedAt,
      completed_at: job.completedAt,
      last_synced_at: job.lastSyncedAt,
      last_event_id: job.lastEventId,
      last_sequence: job.lastEventSequence,
    };
    this.writeJsonAtomic(
      join(this.jobDirectory(job.state.job_id), 'state.json'),
      state,
    );
  }

  private writeJsonAtomic(path: string, value: unknown): void {
    this.temporaryFileSequence += 1;
    const temporaryPath = join(
      this.rootDir,
      `${basename(path)}.${process.pid}-${this.temporaryFileSequence}.tmp`,
    );
    const descriptor = openSync(temporaryPath, 'w', 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporaryPath, path);
  }

  private removeFileIfPresent(path: string): void {
    if (existsSync(path)) {
      unlinkSync(path);
    }
  }

  private jobDirectory(jobId: string): string {
    const windowsReservedName = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    const directoryName =
      /^[A-Za-z0-9_-]+$/.test(jobId) && !windowsReservedName.test(jobId)
        ? jobId
        : `encoded-${createHash('sha256').update(jobId).digest('hex')}`;
    return join(this.jobsDir, directoryName);
  }
}
