import { isDeepStrictEqual } from 'node:util';
import {
  isTrouteJobTerminalStatus,
  trouteJobIdSchema,
  trouteOptimizeResponseSchema,
  type TrouteJobEvent,
  type TrouteJobState,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';

type StoredTrouteJob = {
  state: TrouteJobState;
  synchronousResultCanonical: string | null;
};

export type TrouteJobRepositoryErrorKind =
  | 'invalid_job_id'
  | 'job_already_exists'
  | 'job_not_found'
  | 'sequence_conflict'
  | 'progress_decreased'
  | 'progress_status_conflict'
  | 'job_terminal';

export class TrouteJobRepositoryError extends Error {
  public constructor(
    public readonly kind: TrouteJobRepositoryErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'TrouteJobRepositoryError';
  }
}

export class TrouteJobRepository {
  public create(jobId: string): TrouteJobState {
    const parsedJobId = trouteJobIdSchema.safeParse(jobId);
    if (!parsedJobId.success) {
      throw new TrouteJobRepositoryError(
        'invalid_job_id',
        'The troute job id is invalid.',
      );
    }
    if (this.jobs.has(parsedJobId.data)) {
      throw new TrouteJobRepositoryError(
        'job_already_exists',
        'The troute job already exists.',
      );
    }

    const job: TrouteJobState = {
      job_id: parsedJobId.data,
      status: 'pending',
      stage: null,
      progress: 0,
      last_message: null,
      error: null,
      result: null,
      diagnostic: null,
      events: [],
    };
    this.jobs.set(parsedJobId.data, {
      state: job,
      synchronousResultCanonical: null,
    });
    return structuredClone(job);
  }

  public get(jobId: string): TrouteJobState {
    return structuredClone(this.requireJob(jobId).state);
  }

  public acceptEvent(jobId: string, event: TrouteJobEvent): TrouteJobState {
    const storedJob = this.requireJob(jobId);
    const job = storedJob.state;
    const existing = job.events.find(
      (storedEvent) => storedEvent.sequence === event.sequence,
    );
    if (existing && isDeepStrictEqual(existing, event)) {
      return structuredClone(job);
    }
    if (isTrouteJobTerminalStatus(job.status)) {
      throw new TrouteJobRepositoryError(
        'job_terminal',
        'The troute job is already terminal.',
      );
    }

    const expectedSequence = job.events.length + 1;
    if (event.sequence !== expectedSequence) {
      throw new TrouteJobRepositoryError(
        'sequence_conflict',
        `Expected event sequence ${expectedSequence}.`,
      );
    }

    if (event.type === 'progress') {
      if (event.data.progress < job.progress) {
        throw new TrouteJobRepositoryError(
          'progress_decreased',
          'Progress must not decrease.',
        );
      }
      if (
        job.events.some((storedEvent) => storedEvent.type === 'progress') &&
        event.data.status !== 'running'
      ) {
        throw new TrouteJobRepositoryError(
          'progress_status_conflict',
          'Later progress events must have running status.',
        );
      }
    }

    job.events.push(structuredClone(event));
    if (event.type === 'progress') {
      job.status = 'running';
      job.stage = event.data.stage;
      job.progress = event.data.progress;
      if (event.data.message !== undefined) {
        job.last_message = event.data.message;
      }
    } else if (event.type === 'error') {
      job.status = 'failed';
      job.error = structuredClone(event.data);
    } else {
      job.status = 'completed';
      job.stage = null;
      job.progress = 100;
      job.error = null;
      job.result = structuredClone(event.data);
      this.reconcileResult(storedJob);
    }

    return structuredClone(job);
  }

  public recordSynchronousResult(
    jobId: string,
    result: TrouteOptimizeResponse,
  ): TrouteJobState {
    const storedJob = this.requireJob(jobId);
    const normalizedResult = trouteOptimizeResponseSchema.parse(result);
    storedJob.synchronousResultCanonical = JSON.stringify(normalizedResult);
    this.reconcileResult(storedJob);
    return structuredClone(storedJob.state);
  }

  private readonly jobs = new Map<string, StoredTrouteJob>();

  private requireJob(jobId: string): StoredTrouteJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new TrouteJobRepositoryError(
        'job_not_found',
        'The troute job does not exist.',
      );
    }
    return job;
  }

  private reconcileResult(job: StoredTrouteJob): void {
    if (
      job.synchronousResultCanonical === null ||
      job.state.result === null ||
      job.state.diagnostic !== null
    ) {
      return;
    }

    const callbackResultCanonical = JSON.stringify(job.state.result);
    if (callbackResultCanonical !== job.synchronousResultCanonical) {
      job.state.diagnostic = { code: 'RESULT_MISMATCH' };
      console.error('RESULT_MISMATCH: troute job', {
        jobId: job.state.job_id,
      });
    }
  }
}
