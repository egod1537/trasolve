import {
  trouteJobCancelledEventSchema,
  trouteJobCompletedEventSchema,
  trouteJobFailedEventSchema,
  trouteJobIdSchema,
  trouteLegacyFlatJobEventSchema,
  trouteJobProgressEventSchema,
  trouteJobSnapshotEventSchema,
  trouteJobSubmissionResponseSchema,
  trouteOptimizeRequestSchema,
  trouteRemoteJobListResponseSchema,
  trouteRemoteJobSchema,
  trouteRemoteTimelineSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteRemoteJob,
  type TrouteRemoteJobSummary,
  type TrouteRemoteTimeline,
} from '@trasolve/shared';
import { TrouteClientError } from './errors.js';
import { parseServerSentEvents } from './serverSentEvents.js';
import {
  loadExternalApiPolicy,
  type ExternalApiPolicy,
} from '../configuration/externalApiPolicy.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export type TrouteClientConfig = {
  baseUrl: string;
  timeoutMs?: number;
  externalApiPolicy?: ExternalApiPolicy;
};

export type TrouteJobEventType =
  'snapshot' | 'progress' | 'completed' | 'failed' | 'cancelled';

export type TrouteJobEvent = {
  type: TrouteJobEventType;
  state: TrouteJobState;
  rawData: string;
  lastEventId: string;
  id?: string;
  sequence?: number;
  updatedAt?: number;
};

type ParsedTrouteJobEvent = {
  format: 'canonical' | 'legacy-flat';
  state: TrouteJobState;
  sequence?: number;
  updated_at?: number;
};

export type OpenTrouteJobEventStreamOptions = {
  signal: AbortSignal;
  lastEventId?: string;
};

export class TrouteClient {
  public constructor(config: TrouteClientConfig) {
    this.externalApiPolicy =
      config.externalApiPolicy ?? loadExternalApiPolicy();
    this.baseUrl =
      this.externalApiPolicy.mode === 'enabled'
        ? this.normalizeBaseUrl(config.baseUrl)
        : new URL('http://localhost/');
    this.timeoutMs = this.normalizeTimeout(
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
  }

  public async submitJob(request: TrouteOptimizeRequest): Promise<string> {
    const parsedRequest = trouteOptimizeRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new TrouteClientError(
        'invalid_request',
        'The troute optimization request is invalid.',
      );
    }
    if (this.externalApiPolicy.resolve('troute', 'submit-job') === 'mock') {
      this.mockJobs.set(
        parsedRequest.data.job_id,
        this.createMockJob(parsedRequest.data),
      );
      return parsedRequest.data.job_id;
    }

    let response: { status: number; body: unknown };
    try {
      response = await this.submitJobRequest(parsedRequest.data);
    } catch (cause) {
      if (!this.shouldRetryLegacyLatest(cause, parsedRequest.data)) {
        throw cause;
      }
      response = await this.submitJobRequest(
        this.createLegacyLatestRequest(parsedRequest.data),
      );
    }
    if (response.status !== 202) {
      throw this.invalidResponseError();
    }
    const parsedResponse = trouteJobSubmissionResponseSchema.safeParse(
      response.body,
    );
    if (
      !parsedResponse.success ||
      parsedResponse.data.job_id !== parsedRequest.data.job_id
    ) {
      throw this.invalidResponseError();
    }
    return parsedResponse.data.job_id;
  }

  public async getJob(jobId: string): Promise<TrouteRemoteJob> {
    const normalizedJobId = this.parseJobId(jobId);
    if (this.externalApiPolicy.resolve('troute', 'get-job') === 'mock') {
      return this.getMockJob(normalizedJobId);
    }
    const endpoint = `integration/jobs/${encodeURIComponent(normalizedJobId)}`;
    const body = await this.requestJson(endpoint);
    const parsed = trouteRemoteJobSchema.safeParse(body);
    if (!parsed.success) {
      console.error('troute remote Job 응답 검증에 실패했습니다.', {
        endpoint,
        jobId: normalizedJobId,
        issues: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      throw this.invalidResponseError();
    }
    return parsed.data;
  }

  public async listJobs(limit: number): Promise<TrouteRemoteJobSummary[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new TrouteClientError(
        'invalid_request',
        'The troute job list limit must be between 1 and 100.',
      );
    }
    if (this.externalApiPolicy.resolve('troute', 'list-jobs') === 'mock') {
      return [...this.mockJobs.values()].slice(0, limit).map((job) => ({
        job_id: job.job_id,
        status: job.status,
        created_at: job.created_at,
        updated_at: job.updated_at,
      }));
    }
    const query = new URLSearchParams({ limit: String(limit) });
    const body = await this.requestJson(`integration/jobs?${query}`);
    const parsed = trouteRemoteJobListResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw this.invalidResponseError();
    }
    return parsed.data.jobs;
  }

  public async getTimeline(jobId: string): Promise<TrouteRemoteTimeline> {
    const normalizedJobId = this.parseJobId(jobId);
    if (this.externalApiPolicy.resolve('troute', 'get-timeline') === 'mock') {
      this.getMockJob(normalizedJobId);
      return { job_id: normalizedJobId, entries: [] };
    }
    const body = await this.requestJson(
      `integration/jobs/${encodeURIComponent(normalizedJobId)}/timeline`,
    );
    const parsed = trouteRemoteTimelineSchema.safeParse(body);
    if (!parsed.success) {
      throw this.invalidResponseError();
    }
    return parsed.data;
  }

  public async cancelJob(jobId: string): Promise<void> {
    const normalizedJobId = this.parseJobId(jobId);
    if (this.externalApiPolicy.resolve('troute', 'cancel-job') === 'mock') {
      const job = this.getMockJob(normalizedJobId);
      this.mockJobs.set(normalizedJobId, {
        ...job,
        status: 'cancelled',
        progress: 100,
        result: null,
        completed_at: MOCK_TIMESTAMP,
      });
      return;
    }
    await this.requestWithoutBody(
      `integration/jobs/${encodeURIComponent(normalizedJobId)}/cancel`,
      { method: 'POST' },
    );
  }

  public async *openJobEventStream(
    jobId: string,
    options: OpenTrouteJobEventStreamOptions,
  ): AsyncGenerator<TrouteJobEvent> {
    const normalizedJobId = this.parseJobId(jobId);
    if (this.externalApiPolicy.resolve('troute', 'job-events') === 'mock') {
      const job = this.getMockJob(normalizedJobId);
      const type = job.status === 'cancelled' ? 'cancelled' : 'completed';
      const body = JSON.stringify({
        sequence: 1,
        updated_at: job.updated_at,
        state: {
          job_id: job.job_id,
          status: job.status,
          stage: job.stage,
          progress: job.progress,
          last_message: job.last_message,
          error: job.error,
          result: job.result,
        },
      });
      yield {
        type,
        state: JSON.parse(body).state as TrouteJobState,
        rawData: body,
        lastEventId: 'mock-1',
        id: 'mock-1',
        sequence: 1,
        updatedAt: job.updated_at,
      };
      return;
    }
    const endpoint = `integration/jobs/${encodeURIComponent(normalizedJobId)}/events`;
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (options.lastEventId) {
      headers['Last-Event-ID'] = options.lastEventId;
    }

    let response: Response;
    try {
      this.externalApiPolicy.assertNetworkAllowed('troute', 'job-events');
      response = await fetch(new URL(endpoint, this.baseUrl), {
        headers,
        signal: options.signal,
      });
    } catch {
      if (options.signal.aborted) {
        return;
      }
      throw new TrouteClientError(
        'connection_failure',
        'The troute event stream is unavailable.',
      );
    }
    if (!response.ok) {
      const upstreamBody = await this.readResponseBody(response);
      throw new TrouteClientError(
        'upstream_http',
        `The troute event stream returned HTTP ${response.status}.`,
        response.status,
        upstreamBody,
      );
    }
    if (
      !response.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('text/event-stream') ||
      response.body === null
    ) {
      throw this.invalidResponseError();
    }

    try {
      for await (const event of parseServerSentEvents(response.body)) {
        if (!isTrouteJobEventType(event.event)) {
          continue;
        }
        const parsed = this.parseJobEvent(event.event, event.data);
        if (parsed.state.job_id !== normalizedJobId) {
          throw this.invalidResponseError();
        }
        const sequence =
          parsed.sequence ??
          (parsed.format === 'legacy-flat'
            ? parseSseEventSequence(event.id)
            : undefined);
        yield {
          type: event.event,
          state: parsed.state,
          rawData: event.data,
          lastEventId: event.lastEventId,
          ...(event.id === undefined ? {} : { id: event.id }),
          ...(sequence === undefined ? {} : { sequence }),
          ...(parsed.updated_at === undefined
            ? {}
            : { updatedAt: parsed.updated_at }),
        };
      }
    } catch (cause) {
      if (options.signal.aborted) {
        return;
      }
      if (cause instanceof TrouteClientError) {
        throw cause;
      }
      throw new TrouteClientError(
        'connection_failure',
        'The troute event stream was interrupted.',
      );
    }
  }

  public async checkHealth(): Promise<void> {
    if (this.externalApiPolicy.resolve('troute', 'health') === 'mock') {
      return;
    }
    const body = await this.requestJson('health');
    if (
      typeof body !== 'object' ||
      body === null ||
      !('status' in body) ||
      body.status !== 'ok'
    ) {
      throw this.invalidResponseError();
    }
  }

  private readonly baseUrl: URL;
  private readonly timeoutMs: number;
  private readonly externalApiPolicy: ExternalApiPolicy;
  private readonly mockJobs = new Map<string, TrouteRemoteJob>();

  private async submitJobRequest(
    request: TrouteOptimizeRequest,
  ): Promise<{ status: number; body: unknown }> {
    return this.request(
      'integration/jobs',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
      true,
    );
  }

  private shouldRetryLegacyLatest(
    cause: unknown,
    request: TrouteOptimizeRequest,
  ): boolean {
    return (
      request.start_policy === 'LATEST' &&
      request.start_time === undefined &&
      cause instanceof TrouteClientError &&
      cause.kind === 'upstream_http' &&
      cause.upstreamStatus === 400 &&
      isInvalidUpstreamRequest(cause.upstreamBody)
    );
  }

  private createLegacyLatestRequest(
    request: TrouteOptimizeRequest,
  ): TrouteOptimizeRequest {
    const legacyRequest: TrouteOptimizeRequest = {
      ...request,
      start_time: '00:00',
    };
    delete legacyRequest.start_policy;
    return trouteOptimizeRequestSchema.parse(legacyRequest);
  }

  private parseJobId(jobId: string): string {
    const parsed = trouteJobIdSchema.safeParse(jobId);
    if (!parsed.success) {
      throw new TrouteClientError(
        'invalid_request',
        'The troute job id is invalid.',
      );
    }
    return parsed.data;
  }

  private async requestJson(
    path: string,
    init?: RequestInit,
  ): Promise<unknown> {
    return (await this.request(path, init, true)).body;
  }

  private async requestWithoutBody(
    path: string,
    init?: RequestInit,
  ): Promise<void> {
    await this.request(path, init, false);
  }

  private async request(
    path: string,
    init: RequestInit | undefined,
    parseJson: boolean,
  ): Promise<{ status: number; body: unknown }> {
    this.externalApiPolicy.assertNetworkAllowed('troute', path);
    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await fetch(new URL(path, this.baseUrl), {
        ...init,
        signal,
      });
      if (!response.ok) {
        const upstreamBody = await this.readResponseBody(response);
        throw new TrouteClientError(
          'upstream_http',
          `The troute server returned HTTP ${response.status}.`,
          response.status,
          upstreamBody,
        );
      }
      if (!parseJson) {
        await response.arrayBuffer();
        return { status: response.status, body: null };
      }
      try {
        return {
          status: response.status,
          body: (await response.json()) as unknown,
        };
      } catch {
        if (signal.aborted) {
          throw this.timeoutError();
        }
        throw this.invalidResponseError();
      }
    } catch (cause) {
      if (cause instanceof TrouteClientError) {
        throw cause;
      }
      if (signal.aborted) {
        throw this.timeoutError();
      }
      throw new TrouteClientError(
        'connection_failure',
        'The troute server is unavailable.',
      );
    }
  }

  private parseJobEvent(
    type: TrouteJobEventType,
    data: string,
  ): ParsedTrouteJobEvent {
    let body: unknown;
    try {
      body = JSON.parse(data) as unknown;
    } catch {
      throw this.invalidResponseError();
    }
    const schema = (() => {
      switch (type) {
        case 'snapshot':
          return trouteJobSnapshotEventSchema;
        case 'progress':
          return trouteJobProgressEventSchema;
        case 'completed':
          return trouteJobCompletedEventSchema;
        case 'failed':
          return trouteJobFailedEventSchema;
        case 'cancelled':
          return trouteJobCancelledEventSchema;
      }
    })();
    const envelope = schema.safeParse(body);
    if (envelope.success) {
      return { format: 'canonical', ...envelope.data };
    }

    const legacy = trouteLegacyFlatJobEventSchema.safeParse(body);
    const state = legacy.success
      ? {
          job_id: legacy.data.job_id,
          status: legacy.data.status,
          stage: legacy.data.stage,
          progress: legacy.data.progress,
          last_message: legacy.data.last_message,
          error: legacy.data.error ?? null,
          result: legacy.data.result ?? null,
        }
      : null;
    if (
      !legacy.success ||
      state === null ||
      !eventMatchesState(type, state.status, state)
    ) {
      throw this.invalidResponseError();
    }
    return {
      format: 'legacy-flat',
      state,
      ...(legacy.data.sequence === undefined
        ? {}
        : { sequence: legacy.data.sequence }),
      ...(legacy.data.updated_at === undefined
        ? {}
        : { updated_at: legacy.data.updated_at }),
    };
  }

  private normalizeBaseUrl(value: string): URL {
    try {
      const url = new URL(value.trim());
      if (
        (url.protocol !== 'http:' && url.protocol !== 'https:') ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error('Unsupported troute base URL.');
      }
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
      return url;
    } catch {
      throw new TrouteClientError(
        'configuration',
        'TROUTE_BASE_URL must be a valid HTTP or HTTPS URL.',
      );
    }
  }

  private normalizeTimeout(value: number): number {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TrouteClientError(
        'configuration',
        'The troute timeout must be a positive integer.',
      );
    }
    return value;
  }

  private async readResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private invalidResponseError(): TrouteClientError {
    return new TrouteClientError(
      'invalid_response',
      'The troute response is invalid.',
    );
  }

  private timeoutError(): TrouteClientError {
    return new TrouteClientError('timeout', 'The troute request timed out.');
  }

  private createMockJob(request: TrouteOptimizeRequest): TrouteRemoteJob {
    const start = request.start_time ?? '09:00';
    const route = request.locations.map((location, index) => {
      const arrival = addClockMinutes(start, index * 20);
      return {
        location_id: location.id,
        order: index,
        arrival_time: arrival,
        service_start_time: arrival,
        departure_time: addClockMinutes(arrival, location.stay_minutes),
        wait_minutes: 0,
        stay_minutes: location.stay_minutes,
      };
    });
    return {
      request,
      job_id: request.job_id,
      status: 'completed',
      stage: null,
      progress: 100,
      last_message: 'Trasolve deterministic troute mock completed.',
      created_at: MOCK_TIMESTAMP,
      updated_at: MOCK_TIMESTAMP,
      completed_at: MOCK_TIMESTAMP,
      result: {
        route,
        total_travel_minutes: Math.max(0, request.locations.length - 1) * 10,
        ...(request.start_policy ? { start_policy: request.start_policy } : {}),
        selected_start_time: start,
      },
      error: null,
    };
  }

  private getMockJob(jobId: string): TrouteRemoteJob {
    const job = this.mockJobs.get(jobId);
    if (!job) {
      throw new TrouteClientError(
        'upstream_http',
        'The mock troute job was not found.',
        404,
      );
    }
    return job;
  }
}

const MOCK_TIMESTAMP = 1_700_000_000_000;

function addClockMinutes(value: string, minutes: number): string {
  const [hours = 0, currentMinutes = 0] = value.split(':').map(Number);
  const total = (hours * 60 + currentMinutes + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function isTrouteJobEventType(value: string): value is TrouteJobEventType {
  return (
    value === 'snapshot' ||
    value === 'progress' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

function eventMatchesState(
  type: TrouteJobEventType,
  status: TrouteJobState['status'],
  state: Pick<TrouteJobState, 'error' | 'result'>,
): boolean {
  switch (type) {
    case 'snapshot':
      return true;
    case 'progress':
      return status === 'pending' || status === 'running';
    case 'completed':
      return status === 'completed' && state.result !== null;
    case 'failed':
      return status === 'failed' && state.error !== null;
    case 'cancelled':
      return status === 'cancelled';
  }
}

function parseSseEventSequence(value: string | undefined): number | undefined {
  if (!value || !/^(0|[1-9]\d*)$/.test(value)) {
    return undefined;
  }
  const sequence = Number(value);
  return Number.isSafeInteger(sequence) ? sequence : undefined;
}

function isInvalidUpstreamRequest(body: unknown): boolean {
  if (!body || typeof body !== 'object' || !('error' in body)) {
    return false;
  }
  const error = body.error;
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'INVALID_REQUEST'
  );
}
