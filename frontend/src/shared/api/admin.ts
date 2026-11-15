import {
  API_ROUTES,
  adminAuditListResponseSchema,
  adminMeResponseSchema,
  adminOperationsSummaryResponseSchema,
  adminSummaryResponseSchema,
  adminTripListResponseSchema,
  adminTripMetadataResponseSchema,
  adminUserActionResponseSchema,
  adminUserDetailResponseSchema,
  adminUserListResponseSchema,
  buildAdminTripMetadataApiRoute,
  buildAdminUserActionApiRoute,
  buildAdminUserApiRoute,
  externalApiUsageSummaryResponseSchema,
  type AdminAuditListResponse,
  type AdminMeResponse,
  type AdminOperationsSummaryResponse,
  type AdminSummaryResponse,
  type AdminTripListResponse,
  type AdminTripMetadataResponse,
  type AdminUserActionResponse,
  type AdminUserDetailResponse,
  type AdminUserListResponse,
  type ExternalApiUsageSummaryResponse,
} from '@trasolve/shared';
import type { z } from 'zod';

export class AdminApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'AdminApiError';
  }
}

export function fetchAdminMe(): Promise<AdminMeResponse> {
  return request(API_ROUTES.adminMe, adminMeResponseSchema);
}

export function fetchAdminSummary(): Promise<AdminSummaryResponse> {
  return request(API_ROUTES.adminSummary, adminSummaryResponseSchema);
}

export function fetchAdminUsers(
  search: URLSearchParams,
): Promise<AdminUserListResponse> {
  return request(
    withQuery(API_ROUTES.adminUsers, search),
    adminUserListResponseSchema,
  );
}

export function fetchAdminUser(
  userId: string,
): Promise<AdminUserDetailResponse> {
  return request(buildAdminUserApiRoute(userId), adminUserDetailResponseSchema);
}

export function mutateAdminUser(
  userId: string,
  action: 'suspend' | 'restore' | 'revoke-sessions',
  csrfToken: string,
  body: { reasonCode?: 'abuse' | 'request' | 'other' } = {},
): Promise<AdminUserActionResponse> {
  return request(
    buildAdminUserActionApiRoute(userId, action),
    adminUserActionResponseSchema,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Trasolve-CSRF': csrfToken,
      },
      body: JSON.stringify(body),
    },
  );
}

export function fetchAdminTrips(
  search: URLSearchParams,
): Promise<AdminTripListResponse> {
  return request(
    withQuery(API_ROUTES.adminTrips, search),
    adminTripListResponseSchema,
  );
}

export function fetchAdminTripMetadata(
  tripId: string,
): Promise<AdminTripMetadataResponse> {
  return request(
    buildAdminTripMetadataApiRoute(tripId),
    adminTripMetadataResponseSchema,
  );
}

export function fetchExternalApiUsage(
  search: URLSearchParams,
): Promise<ExternalApiUsageSummaryResponse> {
  return request(
    withQuery(API_ROUTES.adminApiUsageSummary, search),
    externalApiUsageSummaryResponseSchema,
  );
}

export function fetchAdminOperations(): Promise<AdminOperationsSummaryResponse> {
  return request(
    API_ROUTES.adminOperationsSummary,
    adminOperationsSummaryResponseSchema,
  );
}

export function fetchAdminAudit(
  search: URLSearchParams,
): Promise<AdminAuditListResponse> {
  return request(
    withQuery(API_ROUTES.adminAudit, search),
    adminAuditListResponseSchema,
  );
}

async function request<Output>(
  url: string,
  schema: z.ZodType<Output>,
  init: RequestInit = {},
): Promise<Output> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    credentials: 'same-origin',
    headers,
  });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const code = readErrorCode(body) ?? `HTTP_${response.status}`;
    throw new AdminApiError(response.status, code);
  }
  return schema.parse(body);
}

function withQuery(path: string, search: URLSearchParams): string {
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function readErrorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('error' in value)) {
    return null;
  }
  const error = value.error;
  return error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : null;
}
