import {
  trouteJobCancelledEventSchema,
  trouteJobCompletedEventSchema,
  trouteJobFailedEventSchema,
  trouteJobIdSchema,
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

const DEFAULT_TIMEOUT_MS = 30_000;

export type TrouteClientConfig = {
  baseUrl: string;
  timeoutMs?: number;
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

export type OpenTrouteJobEventStreamOptions = {
  signal: AbortSignal;
  lastEventId?: string;
};

export class TrouteClient {
  public constructor(config: TrouteClientConfig) {
    this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
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
    const endpoint = `integration/jobs/${encodeURIComponent(normalizedJobId)}/events`;
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (options.lastEventId) {
      headers['Last-Event-ID'] = options.lastEventId;
    }

    let response: Response;
    try {
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
        yield {
          type: event.event,
          state: parsed.state,
          rawData: event.data,
          lastEventId: event.lastEventId,
          ...(event.id === undefined ? {} : { id: event.id }),
          ...(parsed.sequence === undefined
            ? {}
            : { sequence: parsed.sequence }),
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

  private parseJobEvent(type: TrouteJobEventType, data: string) {
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw this.invalidResponseError();
    }
    return parsed.data;
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
