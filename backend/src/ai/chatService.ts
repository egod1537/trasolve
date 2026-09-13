import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  CHAT_LIMITS,
  chatRequestSchema,
  chatResponseSchema,
  type ApiErrorResponse,
  type ChatRequest,
  type ChatResponse,
} from '@trasolve/shared';
import type { ChatProvider } from './chatProvider.js';

class ChatError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export class ChatService {
  public constructor(private readonly provider: ChatProvider) {}

  public async chat(request: ChatRequest): Promise<ChatResponse> {
    const parsed = chatRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw this.invalidRequest();
    }
    try {
      const result = chatResponseSchema.safeParse(
        await this.provider.chat(parsed.data),
      );
      if (!result.success) {
        throw this.unavailable();
      }
      return result.data;
    } catch {
      // Provider errors and raw responses must not reach the client.
      throw this.unavailable();
    }
  }

  public async handle(request: IncomingMessage, response: ServerResponse) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        throw new ChatError(
          405,
          'METHOD_NOT_ALLOWED',
          'POST 요청을 사용해 주세요.',
        );
      }
      if (
        request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !==
        'application/json'
      ) {
        throw new ChatError(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Content-Type을 application/json으로 지정해 주세요.',
        );
      }
      const parsed = chatRequestSchema.safeParse(await this.readJson(request));
      if (!parsed.success) {
        throw this.invalidRequest();
      }
      const result = await this.chat(parsed.data);
      if (response.destroyed) {
        return;
      }
      response.writeHead(200);
      response.end(JSON.stringify(result));
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error = cause instanceof ChatError ? cause : this.unavailable();
      const body: ApiErrorResponse = {
        error: { code: error.code, message: error.message },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private invalidRequest() {
    return new ChatError(
      400,
      'INVALID_CHAT_REQUEST',
      '대화 메시지의 역할, 내용 또는 길이를 확인해 주세요.',
    );
  }

  private unavailable() {
    return new ChatError(
      502,
      'CHAT_UNAVAILABLE',
      '답변을 생성할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }

  private readJson(request: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > CHAT_LIMITS.bodyBytes) {
          chunks.length = 0;
          reject(
            new ChatError(
              413,
              'REQUEST_TOO_LARGE',
              '요청 본문은 2MiB 이하여야 합니다.',
            ),
          );
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        if (size > CHAT_LIMITS.bodyBytes) {
          return;
        }
        try {
          resolve(
            JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
          );
        } catch {
          reject(this.invalidRequest());
        }
      });
      request.on('error', reject);
      request.on('aborted', () => reject(this.invalidRequest()));
    });
  }
}
