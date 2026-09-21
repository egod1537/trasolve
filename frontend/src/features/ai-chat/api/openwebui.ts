import {
  API_ROUTES,
  apiErrorSchema,
  openWebUIModelListResponseSchema,
  type OpenWebUIModelListResponse,
} from '@trasolve/shared';

export type { OpenWebUIModel } from '@trasolve/shared';

export async function listOpenWebUIModels(): Promise<OpenWebUIModelListResponse> {
  const timeout = AbortSignal.timeout(20_000);
  let response: Response;
  try {
    response = await fetch(API_ROUTES.openWebUIModels, { signal: timeout });
  } catch {
    throw new Error(
      timeout.aborted
        ? '모델 목록 대기 시간이 초과됐습니다.'
        : '모델 목록 서버에 연결할 수 없습니다.',
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    throw new Error(
      parsed.success
        ? `${parsed.data.error.code}: ${parsed.data.error.message}`
        : '모델 목록을 불러올 수 없습니다.',
    );
  }
  const parsed = openWebUIModelListResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('모델 목록 응답 형식이 올바르지 않습니다.');
  }
  return parsed.data;
}
