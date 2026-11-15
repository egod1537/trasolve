import type { z } from 'zod';
import type {
  adminAuditEventSchema,
  adminAuditListResponseSchema,
  adminIdentitySummarySchema,
  adminJobMirrorSummarySchema,
  adminMeResponseSchema,
  adminOperationsSummaryResponseSchema,
  adminOperationServiceSchema,
  adminRoleSchema,
  adminSummaryResponseSchema,
  adminTripListResponseSchema,
  adminTripMetadataResponseSchema,
  adminTripSummarySchema,
  adminUserActionResponseSchema,
  adminUserDetailResponseSchema,
  adminUserListResponseSchema,
  adminUserStateSchema,
  adminUserSummarySchema,
  externalApiOutcomeSchema,
  externalApiServiceSchema,
  externalApiUsageSummaryResponseSchema,
} from '../schemas/admin.js';

export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminUserState = z.infer<typeof adminUserStateSchema>;
export type AdminUserSummary = z.infer<typeof adminUserSummarySchema>;
export type AdminIdentitySummary = z.infer<typeof adminIdentitySummarySchema>;
export type AdminJobMirrorSummary = z.infer<typeof adminJobMirrorSummarySchema>;
export type AdminMeResponse = z.infer<typeof adminMeResponseSchema>;
export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>;
export type AdminUserDetailResponse = z.infer<
  typeof adminUserDetailResponseSchema
>;
export type AdminSummaryResponse = z.infer<typeof adminSummaryResponseSchema>;
export type AdminUserActionResponse = z.infer<
  typeof adminUserActionResponseSchema
>;
export type AdminTripSummary = z.infer<typeof adminTripSummarySchema>;
export type AdminTripListResponse = z.infer<typeof adminTripListResponseSchema>;
export type AdminTripMetadataResponse = z.infer<
  typeof adminTripMetadataResponseSchema
>;
export type ExternalApiService = z.infer<typeof externalApiServiceSchema>;
export type ExternalApiOutcome = z.infer<typeof externalApiOutcomeSchema>;
export type ExternalApiUsageSummaryResponse = z.infer<
  typeof externalApiUsageSummaryResponseSchema
>;
export type AdminOperationService = z.infer<typeof adminOperationServiceSchema>;
export type AdminOperationsSummaryResponse = z.infer<
  typeof adminOperationsSummaryResponseSchema
>;
export type AdminAuditEvent = z.infer<typeof adminAuditEventSchema>;
export type AdminAuditListResponse = z.infer<
  typeof adminAuditListResponseSchema
>;
