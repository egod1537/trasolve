import { TcacheClientError, type TcacheUpstreamResponse } from './types.js';
import {
  loadExternalApiPolicy,
  type ExternalApiPolicy,
} from '../../configuration/externalApiPolicy.js';
import {
  assertInstrumentedNetworkAllowed,
  instrumentExternalApiFetch,
  resolveInstrumentedExternalApiMode,
} from '../../observability/externalApiUsage/externalApiUsage.js';

const HEALTH_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface TcacheClientConfig {
  baseUrl: string;
  externalApiPolicy?: ExternalApiPolicy;
}

export interface OpenTcacheEventStreamOptions {
  signal: AbortSignal;
  lastEventId?: string;
}

export class TcacheClient {
  public constructor(config: TcacheClientConfig) {
    this.externalApiPolicy =
      config.externalApiPolicy ?? loadExternalApiPolicy();
    this.baseUrl =
      this.externalApiPolicy.mode === 'enabled'
        ? this.normalizeBaseUrl(config.baseUrl)
        : new URL('http://localhost/');
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
    if (
      resolveInstrumentedExternalApiMode(
        this.externalApiPolicy,
        'tcache',
        'job-events',
      ) === 'mock'
    ) {
      const body = [
        'id: mock-1',
        'event: completed',
        `data: ${JSON.stringify({ jobId, status: 'completed' })}`,
        '',
        '',
      ].join('\n');
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }
    const headers: Record<string, string> = { Accept: 'text/event-stream' };
    if (options.lastEventId) {
      headers['Last-Event-ID'] = options.lastEventId;
    }

    let response: Response;
    try {
      assertInstrumentedNetworkAllowed(
        this.externalApiPolicy,
        'tcache',
        'job-events',
      );
      response = await instrumentExternalApiFetch(
        'tcache',
        'job-events',
        () =>
          fetch(new URL(`${this.jobPath(jobId)}/events`, this.baseUrl), {
            headers,
            signal: options.signal,
          }),
        'gateway',
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
  private readonly externalApiPolicy: ExternalApiPolicy;

  private async request(
    path: string,
    init: RequestInit,
    timeoutMs: number,
    callerSignal?: AbortSignal,
  ): Promise<TcacheUpstreamResponse> {
    const operation = this.operationName(path, init.method);
    if (
      resolveInstrumentedExternalApiMode(
        this.externalApiPolicy,
        'tcache',
        operation,
      ) === 'mock'
    ) {
      return this.mockResponse(path, init);
    }
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, timeoutSignal])
      : timeoutSignal;
    try {
      assertInstrumentedNetworkAllowed(
        this.externalApiPolicy,
        'tcache',
        operation,
      );
      const response = await instrumentExternalApiFetch(
        'tcache',
        operation,
        () =>
          fetch(new URL(path, this.baseUrl), {
            ...init,
            signal,
          }),
        'gateway',
      );
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

  private mockResponse(
    path: string,
    init: RequestInit,
  ): TcacheUpstreamResponse {
    if (path === 'health' || path === 'api/route/ping') {
      return this.mockJson(200, { status: 'ok', service: 'tcache' });
    }
    if (path === 'api/route/jobs' && init.method === 'POST') {
      const jobId = this.readMockJobId(init.body);
      return this.mockJson(202, {
        jobId,
        status: 'completed',
      });
    }
    if (
      (path === 'api/route/jobs' && init.method === 'GET') ||
      path.startsWith('api/route/jobs?')
    ) {
      return this.mockJson(200, { jobs: [] });
    }
    const match = /^api\/route\/jobs\/([^/]+)(?:\/(result|cancel))?$/.exec(
      path,
    );
    if (match) {
      const jobId = decodeURIComponent(match[1] ?? 'trasolve-mock-job');
      if (match[2] === 'result') {
        return this.mockJson(200, {
          jobId,
          status: 'completed',
          result: {
            provider: 'mock',
            routes: [
              {
                description: 'trasolve-external-api-mock-v1',
                distanceMeters: 1_000,
                durationSeconds: 600,
                encodedPolyline: '',
                path: [
                  { lat: 37.5665, lng: 126.978 },
                  { lat: 37.554, lng: 126.9708 },
                ],
                bounds: {
                  north: 37.5665,
                  south: 37.554,
                  east: 126.978,
                  west: 126.9708,
                },
                legs: [
                  {
                    distanceMeters: 1_000,
                    durationSeconds: 600,
                    startLocation: { lat: 37.5665, lng: 126.978 },
                    endLocation: { lat: 37.554, lng: 126.9708 },
                    steps: [],
                  },
                ],
                warnings: [],
              },
            ],
          },
        });
      }
      if (match[2] === 'cancel') {
        return this.mockJson(200, { jobId, status: 'cancelled' });
      }
      return this.mockJson(200, { jobId, status: 'completed' });
    }
    assertInstrumentedNetworkAllowed(
      this.externalApiPolicy,
      'tcache',
      'unclassified-request',
    );
    throw new Error('Unreachable external API policy branch.');
  }

  private operationName(path: string, method: string | undefined): string {
    if (path === 'health' || path === 'api/route/ping') {
      return 'health';
    }
    if (path === 'api/route/jobs' && method === 'POST') {
      return 'create-job';
    }
    if (
      (path === 'api/route/jobs' && method === 'GET') ||
      path.startsWith('api/route/jobs?')
    ) {
      return 'list-jobs';
    }
    if (path.endsWith('/result')) {
      return 'get-job-result';
    }
    if (path.endsWith('/cancel')) {
      return 'cancel-job';
    }
    if (/^api\/route\/jobs\/[^/]+$/.test(path)) {
      return 'get-job';
    }
    return 'unclassified-request';
  }

  private mockJson(status: number, value: unknown): TcacheUpstreamResponse {
    return {
      status,
      contentType: 'application/json; charset=utf-8',
      body: new TextEncoder().encode(JSON.stringify(value)),
    };
  }

  private readMockJobId(body: RequestInit['body']): string {
    if (body instanceof Uint8Array) {
      try {
        const parsed = JSON.parse(new TextDecoder().decode(body)) as unknown;
        if (parsed && typeof parsed === 'object') {
          const record = parsed as Record<string, unknown>;
          const value = record.jobId ?? record.job_id ?? record.id;
          if (typeof value === 'string' && value.length > 0) {
            return value;
          }
        }
      } catch {
        // The gateway validates the body contract; the fixture uses a safe ID.
      }
    }
    return 'trasolve-mock-job';
  }
}
