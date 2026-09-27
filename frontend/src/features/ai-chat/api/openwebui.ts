import {
  API_ROUTES,
  openWebUIModelListResponseSchema,
  type OpenWebUIModelListResponse,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';

export type { OpenWebUIModel } from '@trasolve/shared';

export async function listOpenWebUIModels(): Promise<OpenWebUIModelListResponse> {
  const timeout = AbortSignal.timeout(20_000);
  let response: Response;
  try {
    response = await fetch(API_ROUTES.openWebUIModels, { signal: timeout });
  } catch {
    throw new Error(
      timeout.aborted
        ? L('errors:openwebui.error.waitingTimeModelListHasExpired')
        : L('errors:openwebui.error.unableConnectModelListServer'),
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(L('errors:openwebui.error.modelListCouldNotBeLoaded'));
  }
  const parsed = openWebUIModelListResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      L('errors:openwebui.error.modelListResponseFormatIncorrect'),
    );
  }
  return parsed.data;
}
