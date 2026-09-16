import {
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
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

    const signal = AbortSignal.timeout(this.timeoutMs);
    try {
      const response = await fetch(new URL('optimize', this.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedRequest.data),
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

      let body: unknown;
      try {
        body = (await response.json()) as unknown;
      } catch {
        if (signal.aborted) {
          throw this.timeoutError();
        }
        throw this.invalidResponseError();
      }

      const parsedResponse = trouteOptimizeResponseSchema.safeParse(body);
      if (!parsedResponse.success) {
        throw this.invalidResponseError();
      }
      return parsedResponse.data;
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

  private readonly baseUrl: URL;
  private readonly timeoutMs: number;

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
