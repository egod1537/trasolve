import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  API_ROUTES,
  trouteJobEventSchema,
  trouteJobIdSchema,
  type ApiErrorResponse,
  type TrouteJobEventAcceptedResponse,
} from '@trasolve/shared';
import {
  TrouteJobRepository,
  TrouteJobRepositoryError,
} from './trouteJobRepository.js';

type TrouteInboundHealthResponse = {
  status: 'ok';
  service: 'trasolve';
};

class TrouteInboundHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly allow?: string,
  ) {
    super(message);
    this.name = 'TrouteInboundHttpError';
  }
}

export class TrouteInboundHttpService {
  public constructor(private readonly jobs: TrouteJobRepository) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    pathname = new URL(request.url ?? '/', 'http://localhost').pathname,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');

    try {
      if (pathname === API_ROUTES.trouteInternalHealth) {
        this.handleHealth(request, response);
        return;
      }

      const jobRoute = this.parseJobRoute(pathname);
      if (!jobRoute) {
        throw new TrouteInboundHttpError(
          404,
          'NOT_FOUND',
          '요청한 troute 내부 API를 찾을 수 없습니다.',
        );
      }

      if (jobRoute.isEventRoute) {
        await this.handleEvent(request, response, jobRoute.jobId);
        return;
      }
      this.handleInspection(request, response, jobRoute.jobId);
    } catch (cause) {
      this.sendError(response, this.toHttpError(cause));
    }
  }

  private readonly maxBodyBytes = 65_536;

  private handleHealth(
    request: IncomingMessage,
    response: ServerResponse,
  ): void {
    if (request.method !== 'GET') {
      throw new TrouteInboundHttpError(
        405,
        'METHOD_NOT_ALLOWED',
        'GET 요청을 사용해 주세요.',
        'GET',
      );
    }

    const body: TrouteInboundHealthResponse = {
      status: 'ok',
      service: 'trasolve',
    };
    response.writeHead(200);
    response.end(JSON.stringify(body));
  }

  private handleInspection(
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): void {
    if (request.method !== 'GET') {
      throw new TrouteInboundHttpError(
        405,
        'METHOD_NOT_ALLOWED',
        'GET 요청을 사용해 주세요.',
        'GET',
      );
    }

    response.writeHead(200);
    response.end(JSON.stringify(this.jobs.get(jobId)));
  }

  private async handleEvent(
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> {
    if (request.method !== 'POST') {
      throw new TrouteInboundHttpError(
        405,
        'METHOD_NOT_ALLOWED',
        'POST 요청을 사용해 주세요.',
        'POST',
      );
    }
    if (
      request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
      'application/json'
    ) {
      throw new TrouteInboundHttpError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Content-Type을 application/json으로 지정해 주세요.',
      );
    }

    const parsedEvent = trouteJobEventSchema.safeParse(
      await this.readJson(request),
    );
    if (!parsedEvent.success) {
      throw new TrouteInboundHttpError(
        400,
        'INVALID_TROUTE_JOB_EVENT',
        'troute job event의 형식과 값을 확인해 주세요.',
      );
    }

    this.jobs.acceptEvent(jobId, parsedEvent.data);
    const body: TrouteJobEventAcceptedResponse = { status: 'accepted' };
    response.writeHead(202);
    response.end(JSON.stringify(body));
  }

  private parseJobRoute(
    pathname: string,
  ): { jobId: string; isEventRoute: boolean } | null {
    const prefix = `${API_ROUTES.trouteInternalJobs}/`;
    if (!pathname.startsWith(prefix)) {
      return null;
    }

    const segments = pathname.slice(prefix.length).split('/');
    if (
      (segments.length !== 1 &&
        !(segments.length === 2 && segments[1] === 'events')) ||
      !segments[0]
    ) {
      return null;
    }

    let jobId: string;
    try {
      jobId = decodeURIComponent(segments[0]);
    } catch {
      throw new TrouteInboundHttpError(
        400,
        'INVALID_TROUTE_JOB_ID',
        'troute job ID 경로를 확인해 주세요.',
      );
    }
    if (!trouteJobIdSchema.safeParse(jobId).success) {
      throw new TrouteInboundHttpError(
        400,
        'INVALID_TROUTE_JOB_ID',
        'troute job ID 경로를 확인해 주세요.',
      );
    }

    return { jobId, isEventRoute: segments.length === 2 };
  }

  private readJson(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > this.maxBodyBytes) {
          chunks.length = 0;
          reject(
            new TrouteInboundHttpError(
              413,
              'REQUEST_TOO_LARGE',
              '요청 본문은 64KiB 이하여야 합니다.',
            ),
          );
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > this.maxBodyBytes) {
          return;
        }
        try {
          resolve(
            JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          );
        } catch {
          reject(
            new TrouteInboundHttpError(
              400,
              'INVALID_JSON',
              '올바른 JSON 본문을 보내 주세요.',
            ),
          );
        }
      });
      request.on('error', reject);
      request.on('aborted', () =>
        reject(
          new TrouteInboundHttpError(
            400,
            'INVALID_TROUTE_JOB_EVENT',
            'troute job event 요청을 읽을 수 없습니다.',
          ),
        ),
      );
    });
  }

  private toHttpError(cause: unknown): TrouteInboundHttpError {
    if (cause instanceof TrouteInboundHttpError) {
      return cause;
    }
    if (!(cause instanceof TrouteJobRepositoryError)) {
      return new TrouteInboundHttpError(
        500,
        'INTERNAL_ERROR',
        'troute job 요청을 처리할 수 없습니다.',
      );
    }

    switch (cause.kind) {
      case 'invalid_job_id':
        return new TrouteInboundHttpError(
          400,
          'INVALID_TROUTE_JOB_ID',
          'troute job ID를 확인해 주세요.',
        );
      case 'job_not_found':
        return new TrouteInboundHttpError(
          404,
          'TROUTE_JOB_NOT_FOUND',
          'troute job을 찾을 수 없습니다.',
        );
      case 'job_already_exists':
        return new TrouteInboundHttpError(
          409,
          'TROUTE_JOB_ALREADY_EXISTS',
          '같은 ID의 troute job이 이미 존재합니다.',
        );
      case 'sequence_conflict':
        return new TrouteInboundHttpError(
          409,
          'TROUTE_EVENT_SEQUENCE_CONFLICT',
          'troute event sequence가 현재 job 상태와 맞지 않습니다.',
        );
      case 'progress_decreased':
        return new TrouteInboundHttpError(
          409,
          'TROUTE_PROGRESS_DECREASED',
          'troute job 진행률은 감소할 수 없습니다.',
        );
      case 'progress_status_conflict':
        return new TrouteInboundHttpError(
          409,
          'TROUTE_PROGRESS_STATUS_CONFLICT',
          'accepted 이후 event의 status는 running이어야 합니다.',
        );
      case 'job_terminal':
        return new TrouteInboundHttpError(
          409,
          'TROUTE_JOB_TERMINAL',
          '종료된 troute job에는 새 event를 추가할 수 없습니다.',
        );
    }
  }

  private sendError(
    response: ServerResponse,
    error: TrouteInboundHttpError,
  ): void {
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
