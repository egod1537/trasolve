import { once } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { API_ROUTES, type ApiErrorResponse } from '@trasolve/shared';
import { TcacheClient } from './tcacheClient.js';
import {
  TcacheClientError,
  TcacheHttpError,
  type TcacheUpstreamResponse,
} from './types.js';

type TcacheApiErrorResponse = ApiErrorResponse & {
  error: ApiErrorResponse['error'] & { upstreamStatus?: number };
};

type JobRouteAction = 'inspect' | 'events' | 'result' | 'cancel';

export class TcacheJobHttpService {
  public constructor(private readonly client: TcacheClient | null) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');

    try {
      if (pathname === API_ROUTES.tcacheInternalHealth) {
        this.requireMethod(request, 'GET');
        await this.proxyRequest(request, response, (client, signal) =>
          client.checkHealth(signal),
        );
        return;
      }
      if (pathname === API_ROUTES.tcacheInternalJobs) {
        await this.handleJobCollection(request, response);
        return;
      }

      const route = this.parseJobRoute(pathname);
      if (!route) {
        throw new TcacheHttpError(
          404,
          'NOT_FOUND',
          '요청한 tcache 내부 API를 찾을 수 없습니다.',
        );
      }
      switch (route.action) {
        case 'inspect':
          this.requireMethod(request, 'GET');
          await this.proxyRequest(request, response, (client, signal) =>
            client.getJob(route.jobId, signal),
          );
          return;
        case 'result':
          this.requireMethod(request, 'GET');
          await this.proxyRequest(request, response, (client, signal) =>
            client.getJobResult(route.jobId, signal),
          );
          return;
        case 'cancel':
          this.requireMethod(request, 'POST');
          await this.proxyRequest(request, response, (client, signal) =>
            client.cancelJob(route.jobId, signal),
          );
          return;
        case 'events':
          this.requireMethod(request, 'GET');
          await this.handleEventStream(request, response, route.jobId);
      }
    } catch (cause) {
      this.sendError(response, cause);
    }
  }

  private readonly maxBodyBytes = 1_048_576;

  private async handleJobCollection(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    if (request.method === 'GET') {
      const search = new URL(request.url ?? '/', 'http://localhost').search;
      await this.proxyRequest(request, response, (client, signal) =>
        client.listJobs(search, signal),
      );
      return;
    }
    this.requireMethod(request, 'POST');
    if (
      request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
      'application/json'
    ) {
      throw new TcacheHttpError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Content-Type을 application/json으로 지정해 주세요.',
      );
    }
    const body = await this.readBody(request);
    await this.proxyRequest(request, response, async (client, signal) =>
      this.withGatewayJobUrls(await client.createJob(body, signal)),
    );
  }

  private async handleEventStream(
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> {
    const client = this.requireClient();
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    request.once('aborted', abort);
    response.once('close', abort);

    try {
      const rawLastEventId = request.headers['last-event-id'];
      const lastEventId = Array.isArray(rawLastEventId)
        ? rawLastEventId[0]
        : rawLastEventId;
      const upstream = await client.openJobEventStream(jobId, {
        signal: controller.signal,
        ...(lastEventId ? { lastEventId } : {}),
      });
      if (response.destroyed || controller.signal.aborted) {
        return;
      }

      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('X-Accel-Buffering', 'no');
      response.writeHead(upstream.status);
      response.flushHeaders();

      for await (const chunk of upstream.body!) {
        if (controller.signal.aborted || response.destroyed) {
          break;
        }
        if (!response.write(chunk)) {
          await once(response, 'drain', { signal: controller.signal });
        }
      }
      if (!response.destroyed && !response.writableEnded) {
        response.end();
      }
    } finally {
      controller.abort();
      request.off('aborted', abort);
      response.off('close', abort);
    }
  }

  private async proxyRequest(
    request: IncomingMessage,
    response: ServerResponse,
    operation: (
      client: TcacheClient,
      signal: AbortSignal,
    ) => Promise<TcacheUpstreamResponse>,
  ): Promise<void> {
    const client = this.requireClient();
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    request.once('aborted', abort);
    response.once('close', abort);
    try {
      const upstream = await operation(client, controller.signal);
      if (!response.destroyed && !response.writableEnded) {
        this.sendUpstreamResponse(response, upstream);
      }
    } finally {
      request.off('aborted', abort);
      response.off('close', abort);
    }
  }

  private sendUpstreamResponse(
    response: ServerResponse,
    upstream: TcacheUpstreamResponse,
  ): void {
    if (upstream.contentType) {
      response.setHeader('Content-Type', upstream.contentType);
    }
    response.writeHead(upstream.status);
    response.end(upstream.body);
  }

  private withGatewayJobUrls(
    upstream: TcacheUpstreamResponse,
  ): TcacheUpstreamResponse {
    if (!upstream.contentType?.toLowerCase().includes('application/json')) {
      return upstream;
    }
    try {
      const parsed = JSON.parse(
        new TextDecoder().decode(upstream.body),
      ) as unknown;
      if (!isRecord(parsed)) {
        return upstream;
      }
      const rawJobId = parsed.jobId ?? parsed.job_id ?? parsed.id;
      if (typeof rawJobId !== 'string' || rawJobId.length === 0) {
        return upstream;
      }
      const statusUrl = `${API_ROUTES.tcacheInternalJobs}/${encodeURIComponent(rawJobId)}`;
      const camelCase =
        'eventsUrl' in parsed ||
        'statusUrl' in parsed ||
        'resultUrl' in parsed ||
        !(
          'events_url' in parsed ||
          'status_url' in parsed ||
          'result_url' in parsed
        );
      const rewritten = camelCase
        ? {
            ...parsed,
            eventsUrl: `${statusUrl}/events`,
            statusUrl,
            resultUrl: `${statusUrl}/result`,
          }
        : {
            ...parsed,
            events_url: `${statusUrl}/events`,
            status_url: statusUrl,
            result_url: `${statusUrl}/result`,
          };
      return {
        ...upstream,
        body: new TextEncoder().encode(JSON.stringify(rewritten)),
      };
    } catch {
      return upstream;
    }
  }

  private readBody(request: IncomingMessage): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let settled = false;
      request.on('data', (chunk: Buffer) => {
        if (settled) {
          return;
        }
        size += chunk.length;
        if (size > this.maxBodyBytes) {
          settled = true;
          chunks.length = 0;
          reject(
            new TcacheHttpError(
              413,
              'REQUEST_TOO_LARGE',
              '요청 본문은 1MiB 이하여야 합니다.',
            ),
          );
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        if (!settled) {
          settled = true;
          resolve(Buffer.concat(chunks));
        }
      });
      request.on('error', (cause) => {
        if (!settled) {
          settled = true;
          reject(cause);
        }
      });
      request.on('aborted', () => {
        if (!settled) {
          settled = true;
          reject(
            new TcacheHttpError(
              400,
              'INVALID_TCACHE_REQUEST',
              'tcache 요청 본문을 읽을 수 없습니다.',
            ),
          );
        }
      });
    });
  }

  private parseJobRoute(
    pathname: string,
  ): { jobId: string; action: JobRouteAction } | null {
    const prefix = `${API_ROUTES.tcacheInternalJobs}/`;
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const segments = pathname.slice(prefix.length).split('/');
    const action = this.parseJobAction(segments);
    if (!action || !segments[0]) {
      return null;
    }
    let jobId: string;
    try {
      jobId = decodeURIComponent(segments[0]);
    } catch {
      throw this.invalidJobIdError();
    }
    if (
      jobId.length === 0 ||
      jobId.length > 200 ||
      !/^[A-Za-z0-9._:-]+$/.test(jobId)
    ) {
      throw this.invalidJobIdError();
    }
    return { jobId, action };
  }

  private parseJobAction(segments: string[]): JobRouteAction | null {
    if (segments.length === 1) {
      return 'inspect';
    }
    if (segments.length !== 2) {
      return null;
    }
    if (
      segments[1] === 'events' ||
      segments[1] === 'result' ||
      segments[1] === 'cancel'
    ) {
      return segments[1];
    }
    return null;
  }

  private requireMethod(
    request: IncomingMessage,
    method: 'GET' | 'POST',
  ): void {
    if (request.method !== method) {
      throw new TcacheHttpError(
        405,
        'METHOD_NOT_ALLOWED',
        `${method} 요청을 사용해 주세요.`,
        method,
      );
    }
  }

  private requireClient(): TcacheClient {
    if (!this.client) {
      throw new TcacheHttpError(
        503,
        'TCACHE_NOT_CONFIGURED',
        '서버의 TCACHE_BASE_URL 설정을 확인해 주세요.',
      );
    }
    return this.client;
  }

  private invalidJobIdError(): TcacheHttpError {
    return new TcacheHttpError(
      400,
      'INVALID_TCACHE_JOB_ID',
      'tcache Job ID를 확인해 주세요.',
    );
  }

  private sendError(response: ServerResponse, cause: unknown): void {
    if (response.destroyed || response.writableEnded) {
      return;
    }
    if (response.headersSent) {
      response.end();
      return;
    }
    if (
      cause instanceof TcacheClientError &&
      cause.kind === 'upstream_http' &&
      cause.upstreamStatus !== undefined &&
      cause.upstreamStatus >= 400 &&
      cause.upstreamStatus < 500
    ) {
      if (cause.upstreamBody && cause.upstreamBody.byteLength > 0) {
        if (cause.upstreamContentType) {
          response.setHeader('Content-Type', cause.upstreamContentType);
        }
        response.writeHead(cause.upstreamStatus);
        response.end(cause.upstreamBody);
        return;
      }
      const body: TcacheApiErrorResponse = {
        error: {
          code: 'TCACHE_UPSTREAM_ERROR',
          message: 'tcache 요청이 거부되었습니다.',
          upstreamStatus: cause.upstreamStatus,
        },
      };
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.writeHead(cause.upstreamStatus);
      response.end(JSON.stringify(body));
      return;
    }

    const error = this.toHttpError(cause);
    if (error.allow) {
      response.setHeader('Allow', error.allow);
    }
    const body: TcacheApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.upstreamStatus === undefined
          ? {}
          : { upstreamStatus: error.upstreamStatus }),
      },
    };
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.writeHead(error.status);
    response.end(JSON.stringify(body));
  }

  private toHttpError(cause: unknown): TcacheHttpError {
    if (cause instanceof TcacheHttpError) {
      return cause;
    }
    if (!(cause instanceof TcacheClientError)) {
      return new TcacheHttpError(
        500,
        'INTERNAL_ERROR',
        'tcache gateway 요청을 처리할 수 없습니다.',
      );
    }
    switch (cause.kind) {
      case 'configuration':
        return new TcacheHttpError(
          503,
          'TCACHE_NOT_CONFIGURED',
          '서버의 TCACHE_BASE_URL 설정을 확인해 주세요.',
        );
      case 'timeout':
        return new TcacheHttpError(
          504,
          'TCACHE_TIMEOUT',
          'tcache 응답 제한 시간을 초과했습니다.',
        );
      case 'unreachable':
        return new TcacheHttpError(
          502,
          'TCACHE_UNREACHABLE',
          'tcache 서버에 연결할 수 없습니다.',
        );
      case 'upstream_http':
        return new TcacheHttpError(
          502,
          'TCACHE_UPSTREAM_ERROR',
          'tcache upstream 요청이 실패했습니다.',
          undefined,
          cause.upstreamStatus,
        );
      case 'invalid_response':
        return new TcacheHttpError(
          502,
          'TCACHE_UPSTREAM_ERROR',
          'tcache upstream 응답 형식이 올바르지 않습니다.',
        );
      case 'aborted':
        return new TcacheHttpError(
          499,
          'TCACHE_REQUEST_ABORTED',
          'tcache 요청이 중단되었습니다.',
        );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
