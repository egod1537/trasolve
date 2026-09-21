import { TcacheClientError, type TcacheUpstreamResponse } from './types.js';

const HEALTH_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface TcacheClientConfig {
  baseUrl: string;
}

export interface OpenTcacheEventStreamOptions {
  signal: AbortSignal;
  lastEventId?: string;
}

export class TcacheClient {
  public constructor(config: TcacheClientConfig) {
    this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
  }

  public async checkHealth(
    signal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    try {
      return await this.request(
        'health',
        { method: 'GET' },
        HEALTH_TIMEOUT_MS,
        signal,
      );
    } catch (cause) {
      if (
        cause instanceof TcacheClientError &&
        cause.kind === 'upstream_http' &&
        cause.upstreamStatus === 404
      ) {
        return this.request(
          'api/route/ping',
          { method: 'GET' },
          HEALTH_TIMEOUT_MS,
          signal,
        );
      }
      throw cause;
    }
  }

  public createJob(
    body: Uint8Array,
    signal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    return this.request(
      'api/route/jobs',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
      REQUEST_TIMEOUT_MS,
      signal,
    );
  }

  public listJobs(
    search: string,
    signal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    return this.request(
      `api/route/jobs${search}`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
      signal,
    );
  }

  public getJob(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    return this.request(
      this.jobPath(jobId),
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
      signal,
    );
  }

  public getJobResult(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    return this.request(
      `${this.jobPath(jobId)}/result`,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
      signal,
    );
  }

  public cancelJob(
    jobId: string,
    signal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    return this.request(
      `${this.jobPath(jobId)}/cancel`,
      { method: 'POST' },
      REQUEST_TIMEOUT_MS,
      signal,
    );
  }

  public async openJobEventStream(
    jobId: string,
    options: OpenTcacheEventStreamOptions,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (options.lastEventId) {
      headers['Last-Event-ID'] = options.lastEventId;
    }

    let response: Response;
    try {
      response = await fetch(
        new URL(`${this.jobPath(jobId)}/events`, this.baseUrl),
        {
          headers,
          signal: options.signal,
        },
      );
    } catch {
      if (options.signal.aborted) {
        throw new TcacheClientError(
          'aborted',
          'The tcache event stream was aborted.',
        );
      }
      throw new TcacheClientError(
        'unreachable',
        'The tcache event stream is unreachable.',
      );
    }

    if (!response.ok) {
      throw await this.upstreamHttpError(response, true);
    }
    if (
      response.body === null ||
      !response.headers
        .get('content-type')
        ?.toLowerCase()
        .startsWith('text/event-stream')
    ) {
      throw new TcacheClientError(
        'invalid_response',
        'The tcache event stream response is invalid.',
      );
    }
    return response;
  }

  private readonly baseUrl: URL;

  private async request(
    path: string,
    init: RequestInit,
    timeoutMs: number,
    callerSignal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;
    try {
      const response = await fetch(new URL(path, this.baseUrl), {
        ...init,
        signal,
      });
      if (!response.ok) {
        throw await this.upstreamHttpError(response);
      }
      return await this.readResponse(response);
    } catch (cause) {
      if (cause instanceof TcacheClientError) {
        throw cause;
      }
      if (callerSignal?.aborted) {
        throw new TcacheClientError(
          'aborted',
          'The tcache request was aborted.',
        );
      }
      if (timeoutSignal.aborted) {
        throw new TcacheClientError('timeout', 'The tcache request timed out.');
      }
      throw new TcacheClientError(
        'unreachable',
        'The tcache server is unreachable.',
      );
    }
  }

  private async readResponse(
    response: Response,
  ): Promise<TcacheUpstreamResponse> {
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      body: new Uint8Array(await response.arrayBuffer()),
    };
  }

  private async upstreamHttpError(
    response: Response,
    tolerateReadFailure = false,
  ): Promise<TcacheClientError> {
    let body = new Uint8Array();
    try {
      body = new Uint8Array(await response.arrayBuffer());
    } catch (cause) {
      if (!tolerateReadFailure) {
        throw cause;
      }
      // Preserve the upstream status even when its error body is unreadable.
    }
    return new TcacheClientError(
      'upstream_http',
      `The tcache server returned HTTP ${response.status}.`,
      response.status,
      body,
      response.headers.get('content-type'),
    );
  }

  private jobPath(jobId: string): string {
    return `api/route/jobs/${encodeURIComponent(jobId)}`;
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
        throw new Error('Unsupported tcache base URL.');
      }
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
      return url;
    } catch {
      throw new TcacheClientError(
        'configuration',
        'TCACHE_BASE_URL must be a valid HTTP or HTTPS URL.',
      );
    }
  }
}
