import {
  apiErrorSchema,
  externalApiServiceSchema,
  type ApiErrorResponse,
  type ExternalApiService,
} from '@trasolve/shared';

export type ExternalApiNoticeService = ExternalApiService | 'google-maps';

export const EXTERNAL_API_DISABLED_NOTICE_EVENT =
  'trasolve:external-api-disabled';

const DEFAULT_EXTERNAL_API_DISABLED_MESSAGE =
  '현재 외부 API가 비활성화되어 이 기능을 사용할 수 없습니다.';

const EXTERNAL_API_DISABLED_MESSAGES: Record<ExternalApiNoticeService, string> =
  {
    'google-maps':
      '현재 외부 API가 비활성화되어 Google 지도를 사용할 수 없습니다.',
    'google-places':
      '현재 외부 API가 비활성화되어 장소 검색을 사용할 수 없습니다.',
    'google-routes':
      '현재 외부 API가 비활성화되어 경로 검색을 사용할 수 없습니다.',
    'ssu-sso': DEFAULT_EXTERNAL_API_DISABLED_MESSAGE,
    'google-oauth':
      '현재 외부 API가 비활성화되어 Google 로그인을 사용할 수 없습니다.',
    gemini: '현재 외부 API가 비활성화되어 채팅을 사용할 수 없습니다.',
    openwebui: '현재 외부 API가 비활성화되어 채팅을 사용할 수 없습니다.',
    troute: '현재 외부 API가 비활성화되어 경로 최적화를 사용할 수 없습니다.',
    tcache: '현재 외부 API가 비활성화되어 이동 시간 계산을 사용할 수 없습니다.',
  };

let currentExternalApiDisabledNotice: string | null = null;

export class ExternalApiDisabledError extends Error {
  public constructor(
    public readonly service: ExternalApiNoticeService | undefined,
  ) {
    super(getExternalApiDisabledMessage(service));
    this.name = 'ExternalApiDisabledError';
  }
}

export function getExternalApiDisabledMessage(
  service?: ExternalApiNoticeService,
): string {
  return service
    ? EXTERNAL_API_DISABLED_MESSAGES[service]
    : DEFAULT_EXTERNAL_API_DISABLED_MESSAGE;
}

export function notifyExternalApiDisabled(
  service?: ExternalApiNoticeService,
): ExternalApiDisabledError {
  const error = new ExternalApiDisabledError(service);
  publishExternalApiDisabledNotice(error.message);
  return error;
}

export function getCurrentExternalApiDisabledNotice(): string | null {
  return currentExternalApiDisabledNotice;
}

export function reportExternalApiDisabled(
  body: unknown,
): ExternalApiDisabledError | null {
  const error = parseExternalApiDisabledError(body);
  if (!error) {
    return null;
  }
  publishExternalApiDisabledNotice(error.message);
  return error;
}

export function throwIfExternalApiDisabled(body: unknown): void {
  const error = reportExternalApiDisabled(body);
  if (error) {
    throw error;
  }
}

export function normalizeExternalApiDisabledErrorResponse(
  response: ApiErrorResponse,
): ApiErrorResponse {
  const error = reportExternalApiDisabled(response);
  return error
    ? {
        ...response,
        error: { ...response.error, message: error.message },
      }
    : response;
}

export type ExternalApiDisabledNoticeDetail = { message: string };

function publishExternalApiDisabledNotice(message: string): void {
  currentExternalApiDisabledNotice = message;
  window.dispatchEvent(
    new CustomEvent<ExternalApiDisabledNoticeDetail>(
      EXTERNAL_API_DISABLED_NOTICE_EVENT,
      { detail: { message } },
    ),
  );
}

function parseExternalApiDisabledError(
  body: unknown,
): ExternalApiDisabledError | null {
  const parsed = apiErrorSchema.safeParse(body);
  if (!parsed.success || parsed.data.error.code !== 'EXTERNAL_API_DISABLED') {
    return null;
  }
  const service = externalApiServiceSchema.safeParse(parsed.data.error.service);
  return new ExternalApiDisabledError(
    service.success ? service.data : undefined,
  );
}
