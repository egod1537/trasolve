import {
  trouteErrorPayloadSchema,
  trouteJobIdSchema,
  trouteJobStateSchema,
  trouteOptimizeRequestSchema,
  trouteRemoteJobSchema,
  type TrouteErrorPayload,
  type TrouteJobHistoryItem,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteRemoteJob,
  type TrouteRemoteJobSummary,
} from '@trasolve/shared';

export type StoredTrouteJob = {
  state: TrouteJobState;
  request: TrouteOptimizeRequest | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  lastSyncedAt: number | null;
  lastEventId: string | null;
  lastEventSequence: number | null;
};

export type TrouteJobMirrorSnapshot = {
  state: TrouteJobState;
  updatedAt: number;
  lastEventId: string | null;
  lastEventSequence: number | null;
};

export type TrouteJobEventVersion = {
  eventId?: string;
  sequence?: number;
  updatedAt?: number;
};

export type TrouteJobRepositoryErrorKind =
  'invalid_job_id' | 'job_already_exists' | 'job_not_found';

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
  public constructor(private readonly clock: () => number = Date.now) {}

  public create(jobId: string): TrouteJobState;
  public create(request: TrouteOptimizeRequest): TrouteJobState;
  public create(input: string | TrouteOptimizeRequest): TrouteJobState {
    const parsedRequest =
      typeof input === 'string'
        ? null
        : trouteOptimizeRequestSchema.safeParse(input);
    const parsedJobId = trouteJobIdSchema.safeParse(
      typeof input === 'string' ? input : input.job_id,
    );
    if (
      !parsedJobId.success ||
      (parsedRequest !== null && !parsedRequest.success)
    ) {
      throw new TrouteJobRepositoryError(
        'invalid_job_id',
        'The troute job request is invalid.',
      );
    }
    if (this.jobs.has(parsedJobId.data)) {
      throw new TrouteJobRepositoryError(
        'job_already_exists',
        'The troute job already exists.',
      );
    }

    const now = this.clock();
    const state: TrouteJobState = {
      job_id: parsedJobId.data,
      status: 'pending',
      stage: null,
      progress: 0,
      last_message: null,
      error: null,
      result: null,
    };
    const storedJob: StoredTrouteJob = {
      state,
      request: parsedRequest?.success
        ? structuredClone(parsedRequest.data)
        : null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      lastSyncedAt: null,
      lastEventId: null,
      lastEventSequence: null,
    };
    this.persistCreated(storedJob);
    this.jobs.set(parsedJobId.data, storedJob);
    this.persistJobIndex();
    return structuredClone(state);
  }

  public get(jobId: string): TrouteJobState {
    return structuredClone(this.requireJob(jobId).state);
  }

  public has(jobId: string): boolean {
    return this.jobs.has(jobId);
  }

  public getMirrorSnapshot(jobId: string): TrouteJobMirrorSnapshot {
    const job = this.requireJob(jobId);
    return {
      state: structuredClone(job.state),
      updatedAt: job.updatedAt,
      lastEventId: job.lastEventId,
      lastEventSequence: job.lastEventSequence,
    };
  }

  public markGatewayRequestStarted(jobId: string): void {
    this.requireJob(jobId);
    this.gatewayRequestsInFlight.add(jobId);
  }

  public markGatewayRequestFinished(jobId: string): void {
    this.gatewayRequestsInFlight.delete(jobId);
  }

  public isGatewayRequestInFlight(jobId: string): boolean {
    return this.gatewayRequestsInFlight.has(jobId);
  }

  public listRecent(limit: number): TrouteJobHistoryItem[] {
    return [...this.jobs.values()]
      .filter(
        (job): job is StoredTrouteJob & { request: TrouteOptimizeRequest } =>
          job.request !== null,
      )
      .sort(
        (left, right) =>
          right.updatedAt - left.updatedAt || right.createdAt - left.createdAt,
      )
      .slice(0, limit)
      .map((job) => ({
        request: structuredClone(job.request),
        state: structuredClone(job.state),
        created_at: job.createdAt,
        updated_at: job.updatedAt,
        completed_at: job.completedAt,
      }));
  }

  public needsSync(summary: TrouteRemoteJobSummary): boolean {
    const storedJob = this.jobs.get(summary.job_id);
    return (
      storedJob === undefined ||
      storedJob.lastSyncedAt === null ||
      storedJob.updatedAt !== summary.updated_at ||
      storedJob.state.status !== summary.status
    );
  }

  public syncRemoteJob(remoteInput: TrouteRemoteJob): TrouteJobState {
    const remote = trouteRemoteJobSchema.parse(remoteInput);
    if (remote.request.job_id !== remote.job_id) {
      throw new TrouteJobRepositoryError(
        'invalid_job_id',
        'The remote troute job ids do not match.',
      );
    }

    const existing = this.jobs.get(remote.job_id);
    if (existing !== undefined && isTerminal(existing.state.status)) {
      return structuredClone(existing.state);
    }
    if (
      existing !== undefined &&
      existing.lastSyncedAt !== null &&
      remote.updated_at < existing.updatedAt
    ) {
      return structuredClone(existing.state);
    }

    const state: TrouteJobState = {
      job_id: remote.job_id,
      status: remote.status,
      stage: remote.stage,
      progress: remote.progress,
      last_message: remote.last_message,
      error: remote.error,
      result: remote.result,
    };
    const storedJob: StoredTrouteJob = {
      state,
      request: structuredClone(remote.request),
      createdAt: remote.created_at,
      updatedAt: remote.updated_at,
      completedAt: remote.completed_at,
      lastSyncedAt: this.clock(),
      lastEventId: existing?.lastEventId ?? null,
      lastEventSequence: existing?.lastEventSequence ?? null,
    };

    if (existing) {
      this.jobs.set(state.job_id, storedJob);
      this.persistRemoteMirror(storedJob, false);
    } else {
      this.persistRemoteMirror(storedJob, true);
      this.jobs.set(state.job_id, storedJob);
    }
    this.persistJobIndex();
    return structuredClone(state);
  }

  public applyRemoteEvent(
    stateInput: TrouteJobState,
    version: TrouteJobEventVersion,
  ): { state: TrouteJobState; applied: boolean } {
    const state = trouteJobStateSchema.parse(stateInput);
    const storedJob = this.requireJob(state.job_id);
    if (isTerminal(storedJob.state.status)) {
      return { state: structuredClone(storedJob.state), applied: false };
    }
    if (
      (storedJob.state.status === 'running' && state.status === 'pending') ||
      (!isTerminal(state.status) && state.progress < storedJob.state.progress)
    ) {
      return { state: structuredClone(storedJob.state), applied: false };
    }
    if (
      version.eventId !== undefined &&
      version.eventId === storedJob.lastEventId
    ) {
      return { state: structuredClone(storedJob.state), applied: false };
    }
    if (
      version.sequence !== undefined &&
      storedJob.lastEventSequence !== null &&
      version.sequence <= storedJob.lastEventSequence
    ) {
      return { state: structuredClone(storedJob.state), applied: false };
    }
    if (
      version.updatedAt !== undefined &&
      storedJob.lastSyncedAt !== null &&
      version.updatedAt < storedJob.updatedAt
    ) {
      return { state: structuredClone(storedJob.state), applied: false };
    }

    const nextUpdatedAt = version.updatedAt ?? this.clock();
    const stateChanged = !areValuesEqual(storedJob.state, state);
    const versionChanged =
      (version.eventId !== undefined &&
        version.eventId !== storedJob.lastEventId) ||
      (version.sequence !== undefined &&
        version.sequence !== storedJob.lastEventSequence) ||
      nextUpdatedAt !== storedJob.updatedAt;
    if (!stateChanged && !versionChanged) {
      return { state: structuredClone(storedJob.state), applied: false };
    }

    storedJob.state = structuredClone(state);
    storedJob.updatedAt = nextUpdatedAt;
    storedJob.lastSyncedAt = this.clock();
    storedJob.lastEventId = version.eventId ?? storedJob.lastEventId;
    storedJob.lastEventSequence =
      version.sequence ?? storedJob.lastEventSequence;
    storedJob.completedAt = isTerminal(state.status)
      ? (storedJob.completedAt ?? nextUpdatedAt)
      : null;
    this.persistRemoteMirror(storedJob, false);
    this.persistJobIndex();
    return { state: structuredClone(state), applied: true };
  }

  public markGatewayFailed(
    jobId: string,
    error: TrouteErrorPayload,
  ): TrouteJobState {
    const storedJob = this.requireJob(jobId);
    const normalizedError = trouteErrorPayloadSchema.parse(error);
    const now = this.clock();
    storedJob.state.status = 'failed';
    storedJob.state.error = structuredClone(normalizedError);
    storedJob.updatedAt = now;
    storedJob.completedAt = now;
    this.persistGatewayFailure(storedJob, normalizedError);
    this.persistJobIndex();
    return structuredClone(storedJob.state);
  }

  protected restore(storedJob: StoredTrouteJob): void {
    if (this.jobs.has(storedJob.state.job_id)) {
      throw new TrouteJobRepositoryError(
        'job_already_exists',
        'The troute job already exists.',
      );
    }
    this.jobs.set(storedJob.state.job_id, storedJob);
  }

  protected persistCreated(_job: StoredTrouteJob): void {}

  protected persistRemoteMirror(_job: StoredTrouteJob, _isNew: boolean): void {}

  protected persistGatewayFailure(
    _job: StoredTrouteJob,
    _error: TrouteErrorPayload,
  ): void {}

  protected persistJobIndex(): void {}

  private readonly jobs = new Map<string, StoredTrouteJob>();
  private readonly gatewayRequestsInFlight = new Set<string>();

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
}

function isTerminal(status: TrouteJobState['status']): boolean {
  return (
    status === 'completed' || status === 'failed' || status === 'cancelled'
  );
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
