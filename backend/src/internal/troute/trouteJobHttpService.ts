import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  API_ROUTES,
  isTrouteJobTerminalStatus,
  trouteJobIdSchema,
  type ApiErrorResponse,
  type TrouteJobHistoryResponse,
} from '@trasolve/shared';
import { TrouteClientError } from '../../troute/errors.js';
import type { TrouteClient } from '../../troute/trouteClient.js';
import {
  JobEventSubscriptionManager,
  type PublishedTrouteJobEvent,
} from './jobEventSubscriptionManager.js';
import {
  TrouteJobRepository,
  TrouteJobRepositoryError,
} from './trouteJobRepository.js';

type TrouteHealthResponse = {
  status: 'ok';
  service: 'troute';
};

class TrouteJobHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly allow?: string,
  ) {
    super(message);
    this.name = 'TrouteJobHttpError';
  }
}

export class TrouteJobHttpService {
  public constructor(
    private readonly jobs: TrouteJobRepository,
    private readonly client: TrouteClient | null = null,
    private readonly subscriptions: JobEventSubscriptionManager | null = null,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');

    try {
      if (pathname === API_ROUTES.trouteInternalHealth) {
        await this.handleHealth(request, response);
        return;
      }
      if (pathname === API_ROUTES.trouteInternalJobs) {
        await this.handleJobList(request, response);
        return;
      }

      const jobRoute = this.parseJobRoute(pathname);
      if (!jobRoute) {
        throw new TrouteJobHttpError(
          404,
          'NOT_FOUND',
          '요청한 troute 내부 API를 찾을 수 없습니다.',
        );
      }

      if (jobRoute.action === 'cancel') {
        await this.handleCancellation(request, response, jobRoute.jobId);
        return;
      }
      if (jobRoute.action === 'events') {
        await this.handleEventStream(request, response, jobRoute.jobId);
        return;
      }
      await this.handleInspection(request, response, jobRoute.jobId);
    } catch (cause) {
      this.sendError(response, this.toHttpError(cause));
    }
  }

  private async handleHealth(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    this.requireMethod(request, 'GET');
    const client = this.requireClient();
    await client.checkHealth();
    const body: TrouteHealthResponse = { status: 'ok', service: 'troute' };
    response.writeHead(200);
    response.end(JSON.stringify(body));
  }

  private async handleInspection(
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> {
    this.requireMethod(request, 'GET');

    const local = this.jobs.has(jobId) ? this.jobs.get(jobId) : null;
    if (local === null || !isTrouteJobTerminalStatus(local.status)) {
      try {
        const remote = await this.requireClient().getJob(jobId);
        this.jobs.syncRemoteJob(remote);
      } catch (cause) {
        if (
          this.isUpstreamJobNotFound(cause) &&
          this.jobs.has(jobId) &&
          this.jobs.isGatewayRequestInFlight(jobId)
        ) {
          response.writeHead(200);
          response.end(JSON.stringify(this.jobs.get(jobId)));
          return;
        }
        throw cause;
      }
    }

    response.writeHead(200);
    response.end(JSON.stringify(this.jobs.get(jobId)));
  }

  private async handleJobList(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    this.requireMethod(request, 'GET');
    const limit = this.parseLimit(request);

    if (this.client) {
      try {
        const summaries = await this.client.listJobs(limit);
        const results = await Promise.allSettled(
          summaries
            .filter((summary) => this.jobs.needsSync(summary))
            .map(async (summary) => {
              const remote = await this.client?.getJob(summary.job_id);
              if (remote) {
                this.jobs.syncRemoteJob(remote);
              }
            }),
        );
        for (const result of results) {
          if (result.status === 'rejected') {
            console.warn('troute Job mirror 일부를 동기화하지 못했습니다.', {
              cause: result.reason,
            });
          }
        }
      } catch (cause) {
        console.warn(
          'troute Job 목록을 동기화하지 못해 로컬 mirror를 반환합니다.',
          { cause },
        );
      }
    }

    const body: TrouteJobHistoryResponse = {
      jobs: this.jobs.listRecent(limit),
    };
    response.writeHead(200);
    response.end(JSON.stringify(body));
  }

  private async handleCancellation(
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> {
    this.requireMethod(request, 'POST');
    const client = this.requireClient('TROUTE_CANCEL_UPSTREAM_ERROR');

    if (!this.jobs.has(jobId)) {
      this.jobs.syncRemoteJob(await client.getJob(jobId));
    }
    if (isTrouteJobTerminalStatus(this.jobs.get(jobId).status)) {
      throw this.jobNotCancellableError();
    }

    try {
      await client.cancelJob(jobId);
    } catch (cause) {
      throw this.toCancelHttpError(cause);
    }

    try {
      this.jobs.syncRemoteJob(await client.getJob(jobId));
    } catch (cause) {
      console.warn(
        'troute cancel 이후 GET 동기화에 실패해 기존 mirror를 반환합니다.',
        { jobId, cause },
      );
    }
    void this.subscriptions?.track(jobId).catch((cause) => {
      console.warn('취소 요청한 troute Job SSE 추적을 시작하지 못했습니다.', {
        jobId,
        cause,
      });
    });

    response.writeHead(
      isTrouteJobTerminalStatus(this.jobs.get(jobId).status) ? 200 : 202,
    );
    response.end(JSON.stringify(this.jobs.get(jobId)));
  }

  private async handleEventStream(
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> {
    this.requireMethod(request, 'GET');
    const subscriptions = this.requireSubscriptions();
    const pending: PublishedTrouteJobEvent[] = [];
    let streaming = false;
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const close = (): void => {
      if (closed) {
        return;
      }
      closed = true;
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      unsubscribe?.();
      unsubscribe = null;
    };
    const send = (event: PublishedTrouteJobEvent): void => {
      if (!streaming) {
        pending.push(event);
        return;
      }
      if (closed || response.destroyed || response.writableEnded) {
        return;
      }
      response.write(formatServerSentEvent(event));
      if (isTrouteJobTerminalStatus(event.state.status)) {
        response.end();
        close();
      }
    };

    unsubscribe = await subscriptions.subscribe(jobId, send);
    if (response.destroyed) {
      close();
      return;
    }
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.writeHead(200);
    response.flushHeaders();
    streaming = true;
    for (const event of pending) {
      send(event);
      if (closed) {
        return;
      }
    }
    pending.length = 0;

    heartbeat = setInterval(() => {
      if (!closed && !response.destroyed && !response.writableEnded) {
        response.write(': keep-alive\n\n');
      }
    }, 15_000);
    heartbeat.unref();
    response.once('close', close);
    request.once('aborted', close);
  }

  private parseJobRoute(
    pathname: string,
  ): { jobId: string; action: 'inspect' | 'cancel' | 'events' } | null {
    const prefix = `${API_ROUTES.trouteInternalJobs}/`;
    if (!pathname.startsWith(prefix)) {
      return null;
    }

    const segments = pathname.slice(prefix.length).split('/');
    const action =
      segments.length === 1
        ? 'inspect'
        : segments.length === 2
          ? segments[1] === 'cancel'
            ? 'cancel'
            : segments[1] === 'events'
              ? 'events'
              : null
          : null;
    if (action === null || !segments[0]) {
      return null;
    }

    let jobId: string;
    try {
      jobId = decodeURIComponent(segments[0]);
    } catch {
      throw this.invalidJobIdError();
    }
    if (!trouteJobIdSchema.safeParse(jobId).success) {
      throw this.invalidJobIdError();
    }
    return { jobId, action };
  }

  private parseLimit(request: IncomingMessage): number {
    const rawLimit = new URL(
      request.url ?? '/',
      'http://localhost',
    ).searchParams.get('limit');
    if (rawLimit !== null && !/^[1-9]\d*$/.test(rawLimit)) {
      throw this.invalidLimitError();
    }
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    if (limit > 100) {
      throw this.invalidLimitError();
    }
    return limit;
  }

  private requireMethod(
    request: IncomingMessage,
    method: 'GET' | 'POST',
  ): void {
    if (request.method !== method) {
      throw new TrouteJobHttpError(
        405,
        'METHOD_NOT_ALLOWED',
        `${method} 요청을 사용해 주세요.`,
        method,
      );
    }
  }

  private requireClient(code = 'TROUTE_UPSTREAM_ERROR'): TrouteClient {
    if (!this.client) {
      throw new TrouteJobHttpError(
        503,
        code,
        '서버의 TROUTE_BASE_URL 설정을 확인해 주세요.',
      );
    }
    return this.client;
  }

  private requireSubscriptions(): JobEventSubscriptionManager {
    if (!this.subscriptions) {
      throw new TrouteJobHttpError(
        503,
        'TROUTE_UPSTREAM_ERROR',
        '서버의 TROUTE_BASE_URL 설정을 확인해 주세요.',
      );
    }
    return this.subscriptions;
  }

  private toHttpError(cause: unknown): TrouteJobHttpError {
    if (cause instanceof TrouteJobHttpError) {
      return cause;
    }
    if (cause instanceof TrouteClientError) {
      if (cause.kind === 'upstream_http' && cause.upstreamStatus === 404) {
        return new TrouteJobHttpError(
          404,
          'TROUTE_JOB_NOT_FOUND',
          'troute에서 Job을 찾을 수 없습니다.',
        );
      }
      return new TrouteJobHttpError(
        cause.kind === 'timeout' ? 504 : 502,
        'TROUTE_UPSTREAM_ERROR',
        'troute Job 상태를 동기화할 수 없습니다.',
      );
    }
    if (cause instanceof TrouteJobRepositoryError) {
      switch (cause.kind) {
        case 'invalid_job_id':
          return this.invalidJobIdError();
        case 'job_not_found':
          return new TrouteJobHttpError(
            404,
            'TROUTE_JOB_NOT_FOUND',
            'troute Job을 찾을 수 없습니다.',
          );
        case 'job_already_exists':
          return new TrouteJobHttpError(
            409,
            'TROUTE_JOB_ALREADY_EXISTS',
            '같은 ID의 troute Job이 이미 존재합니다.',
          );
      }
    }
    return new TrouteJobHttpError(
      500,
      'INTERNAL_ERROR',
      'troute Job 요청을 처리할 수 없습니다.',
    );
  }

  private toCancelHttpError(cause: unknown): TrouteJobHttpError {
    if (cause instanceof TrouteClientError && cause.kind === 'upstream_http') {
      if (cause.upstreamStatus === 404) {
        return new TrouteJobHttpError(
          404,
          'TROUTE_JOB_NOT_FOUND',
          'troute에서 Job을 찾을 수 없습니다.',
        );
      }
      if (cause.upstreamStatus === 409) {
        return this.jobNotCancellableError();
      }
    }
    return new TrouteJobHttpError(
      cause instanceof TrouteClientError && cause.kind === 'timeout'
        ? 504
        : 502,
      'TROUTE_CANCEL_UPSTREAM_ERROR',
      'troute Job 강제 종료 요청에 실패했습니다.',
    );
  }

  private isUpstreamJobNotFound(cause: unknown): boolean {
    return (
      cause instanceof TrouteClientError &&
      cause.kind === 'upstream_http' &&
      cause.upstreamStatus === 404
    );
  }

  private invalidJobIdError(): TrouteJobHttpError {
    return new TrouteJobHttpError(
      400,
      'INVALID_TROUTE_JOB_ID',
      'troute Job ID를 확인해 주세요.',
    );
  }

  private invalidLimitError(): TrouteJobHttpError {
    return new TrouteJobHttpError(
      400,
      'INVALID_LIMIT',
      'limit은 1 이상 100 이하의 정수여야 합니다.',
    );
  }

  private jobNotCancellableError(): TrouteJobHttpError {
    return new TrouteJobHttpError(
      409,
      'TROUTE_JOB_NOT_CANCELLABLE',
      '이미 종료된 Job입니다.',
    );
  }

  private sendError(response: ServerResponse, error: TrouteJobHttpError): void {
    if (response.destroyed || response.writableEnded) {
      return;
    }
    if (response.headersSent) {
      response.end();
      return;
    }
    if (error.allow) {
      response.setHeader('Allow', error.allow);
    }
    const body: ApiErrorResponse = {
      error: { code: error.code, message: error.message },
    };
    response.writeHead(error.status);
    response.end(JSON.stringify(body));
  }
}

function formatServerSentEvent(event: PublishedTrouteJobEvent): string {
  const lines: string[] = [];
  if (event.eventId) {
    lines.push(`id: ${sanitizeEventField(event.eventId)}`);
  }
  lines.push(`event: ${event.type}`);
  lines.push(
    `data: ${JSON.stringify({
      state: event.state,
      updated_at: event.updatedAt,
      ...(event.sequence === undefined ? {} : { sequence: event.sequence }),
    })}`,
  );
  lines.push('', '');
  return lines.join('\n');
}

function sanitizeEventField(value: string): string {
  return value.replace(/[\r\n]/g, '');
}
