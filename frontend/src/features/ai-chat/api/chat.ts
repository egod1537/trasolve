import {
  API_ROUTES,
  apiErrorSchema,
  chatRequestSchema,
  chatResponseSchema,
  type ChatRequest,
  type ChatResponse,
} from '@trasolve/shared';

export async function sendChat(
  request: ChatRequest,
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const payload = chatRequestSchema.parse(request);
  const timeout = AbortSignal.timeout(130000);
  let response: Response;
  try {
    response = await fetch(API_ROUTES.chat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (cause) {
    if (signal?.aborted) {
      throw cause;
    }
    throw new Error(
      timeout.aborted
        ? '답변 대기 시간이 초과됐습니다. 다시 시도해 주세요.'
        : '채팅 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success
        ? `${parsed.data.error.code}: ${parsed.data.error.message}`
        : '답변을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  const parsed = chatResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('채팅 응답 형식이 올바르지 않습니다.');
  }
  return parsed.data;
}
