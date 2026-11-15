import type {
  AdminAuditListResponse,
  AdminIdentitySummary,
  AdminOperationsSummaryResponse,
  AdminSummaryResponse,
  AdminTripListResponse,
  AdminTripSummary,
  AdminUserActionResponse,
  AdminUserDetailResponse,
  AdminUserListResponse,
  ExternalApiService,
  ExternalApiUsageSummaryResponse,
} from '@trasolve/shared';

export interface AdminAuthorizationRecord {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly role: 'user' | 'admin';
  readonly deleted: boolean;
  readonly suspended: boolean;
  readonly hasVerifiedGoogleIdentity: boolean;
}

export interface AdminPageCursor {
  readonly at: Date;
  readonly id: string;
}

export interface AdminUserListInput {
  readonly query: string;
  readonly role: 'user' | 'admin' | null;
  readonly state: 'active' | 'suspended' | null;
  readonly limit: number;
  readonly cursor: AdminPageCursor | null;
}

export interface AdminTripListInput {
  readonly query: string;
  readonly ownerUserId: string | null;
  readonly shared: boolean | null;
  readonly limit: number;
  readonly cursor: AdminPageCursor | null;
}

export interface AdminUsageInput {
  readonly from: Date;
  readonly to: Date;
  readonly service: ExternalApiService | null;
  readonly actorUserId: string | null;
  readonly bucket: 'hour' | 'day';
}

export interface AdminAuditInput {
  readonly from: Date | null;
  readonly to: Date | null;
  readonly action: string | null;
  readonly actorUserId: string | null;
  readonly limit: number;
  readonly cursor: AdminPageCursor | null;
}

export type AdminUserMutation = 'suspend' | 'restore' | 'revoke-sessions';

export interface AdminRepository {
  getAuthorization(
    userId: string,
  ): Promise<AdminAuthorizationRecord | undefined>;
  listUsers(input: AdminUserListInput): Promise<AdminUserListResponse>;
  getUserDetail(userId: string): Promise<AdminUserDetailResponse | undefined>;
  getSummary(): Promise<AdminSummaryResponse>;
  mutateUser(
    actorUserId: string,
    targetUserId: string,
    mutation: AdminUserMutation,
    reasonCode?: 'abuse' | 'request' | 'other',
  ): Promise<AdminUserActionResponse | undefined>;
  listTrips(input: AdminTripListInput): Promise<AdminTripListResponse>;
  getTripMetadata(
    tripId: string,
  ): Promise<(AdminTripSummary & { schemaVersion: number }) | undefined>;
  getUsageSummary(
    input: AdminUsageInput,
  ): Promise<ExternalApiUsageSummaryResponse>;
  getOperationsSummary(
    from: Date,
    to: Date,
  ): Promise<AdminOperationsSummaryResponse>;
  listAudit(input: AdminAuditInput): Promise<AdminAuditListResponse>;
}

export interface BootstrapAdminRecord {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly issuer: string;
  readonly role: 'user' | 'admin';
}

export interface AdminBootstrapRepository {
  inspect(userId: string): Promise<BootstrapAdminRecord | undefined>;
  grant(userId: string): Promise<BootstrapAdminRecord | undefined>;
}

export interface AdminIdentityCollection {
  readonly identities: AdminIdentitySummary[];
  readonly recentActivityCount: number | null;
}
