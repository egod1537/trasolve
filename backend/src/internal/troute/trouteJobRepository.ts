import {
  trouteErrorPayloadSchema,
  trouteJobIdSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  trouteRemoteJobSchema,
  type TrouteErrorPayload,
  type TrouteJobHistoryItem,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
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

  public recordGatewayResult(
    jobId: string,
    result: TrouteOptimizeResponse,
  ): TrouteJobState {
    const storedJob = this.requireJob(jobId);
    const normalizedResult = trouteOptimizeResponseSchema.parse(result);
    const now = this.clock();
    storedJob.state.status = 'completed';
    storedJob.state.stage = null;
    storedJob.state.progress = 100;
    storedJob.state.last_message = 'troute 최적화 응답을 받았습니다.';
    storedJob.state.error = null;
    storedJob.state.result = structuredClone(normalizedResult);
    storedJob.updatedAt = now;
    storedJob.completedAt = now;
    this.persistGatewayResult(storedJob, normalizedResult);
    this.persistJobIndex();
    return structuredClone(storedJob.state);
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

  protected persistGatewayResult(
    _job: StoredTrouteJob,
    _result: TrouteOptimizeResponse,
  ): void {}

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
