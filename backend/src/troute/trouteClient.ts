import {
  trouteJobIdSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  trouteRemoteJobListResponseSchema,
  trouteRemoteJobSchema,
  trouteRemoteTimelineSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
  type TrouteRemoteJob,
  type TrouteRemoteJobSummary,
  type TrouteRemoteTimeline,
} from '@trasolve/shared';
import { TrouteClientError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export type TrouteClientConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

export class TrouteClient {
  public constructor(config: TrouteClientConfig) {
    this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
    this.timeoutMs = this.normalizeTimeout(
      config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );
  }

  public async optimize(
    request: TrouteOptimizeRequest,
  ): Promise<TrouteOptimizeResponse> {
    const parsedRequest = trouteOptimizeRequestSchema.safeParse(request);
    if (!parsedRequest.success) {
      throw new TrouteClientError(
        'invalid_request',
        'The troute optimization request is invalid.',
      );
    }

    const body = await this.requestJson('optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsedRequest.data),
    });
    const parsedResponse = trouteOptimizeResponseSchema.safeParse(body);
    if (!parsedResponse.success) {
      throw this.invalidResponseError();
    }
    return parsedResponse.data;
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
    return this.request(path, init, true);
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
  ): Promise<unknown> {
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
        return null;
      }
      try {
        return (await response.json()) as unknown;
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
