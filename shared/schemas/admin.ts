import { z } from 'zod';

export const adminRoleSchema = z.enum(['user', 'admin']);
export const adminUserStateSchema = z.enum(['active', 'suspended']);
export const adminReasonCodeSchema = z.enum(['abuse', 'request', 'other']);
export const externalApiServiceSchema = z.enum([
  'google-places',
  'google-routes',
  'gemini',
  'openwebui',
  'troute',
  'tcache',
  'google-oauth',
  'ssu-sso',
]);
export const externalApiOutcomeSchema = z.enum([
  'success',
  'http_error',
  'network_error',
  'blocked',
  'mock',
]);

const nullableIsoDatetimeSchema = z.iso.datetime().nullable();
const nullableNonnegativeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .nullable();

export const adminUserSummarySchema = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
  avatarUrl: z.url().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  role: adminRoleSchema,
  state: adminUserStateSchema,
  createdAt: z.iso.datetime(),
  lastLoginAt: nullableIsoDatetimeSchema,
  tripCount: z.number().int().nonnegative(),
});

export const adminIdentitySummarySchema = z.strictObject({
  issuer: z.string().min(1),
  subjectHint: z.string().min(1),
  emailHint: z.string().nullable(),
  emailVerified: z.boolean(),
  lastLoginAt: nullableIsoDatetimeSchema,
});

export const adminMeResponseSchema = z.strictObject({
  user: z.strictObject({
    id: z.uuid(),
    name: z.string().min(1).optional(),
    email: z.string().min(1),
  }),
  role: z.literal('admin'),
  csrfToken: z.string().min(1),
});

export const adminUserListResponseSchema = z.strictObject({
  users: z.array(adminUserSummarySchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
  appliedFilters: z.strictObject({
    query: z.string(),
    role: adminRoleSchema.nullable(),
    state: adminUserStateSchema.nullable(),
    limit: z.number().int().min(1).max(100),
  }),
});

export const adminUserDetailResponseSchema = z.strictObject({
  user: adminUserSummarySchema,
  identities: z.array(adminIdentitySummarySchema),
  recentActivityCount: nullableNonnegativeIntegerSchema,
});

export const adminSummaryResponseSchema = z.strictObject({
  totalUsers: z.number().int().nonnegative(),
  activeUsers: z.number().int().nonnegative(),
  recentLoginUsers: z.number().int().nonnegative(),
  totalTrips: z.number().int().nonnegative(),
  recentLoginWindowDays: z.literal(7),
  timeZone: z.literal('Asia/Seoul'),
  generatedAt: z.iso.datetime(),
});

export const adminUserActionResponseSchema = z.strictObject({
  userId: z.uuid(),
  state: adminUserStateSchema,
  changed: z.boolean(),
  revokedSessionCount: z.number().int().nonnegative(),
});

export const adminTripSummarySchema = z.strictObject({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  owner: z.strictObject({
    id: z.uuid(),
    displayName: z.string(),
  }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  startDate: z.iso.date().nullable(),
  endDate: z.iso.date().nullable(),
  dayCount: z.number().int().nonnegative(),
  placeCount: z.number().int().nonnegative(),
  shareEnabled: z.boolean(),
  searchable: z.boolean(),
  revision: z.string().regex(/^[1-9]\d*$/),
});

export const adminTripListResponseSchema = z.strictObject({
  trips: z.array(adminTripSummarySchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
  appliedFilters: z.strictObject({
    query: z.string(),
    ownerUserId: z.uuid().nullable(),
    shared: z.boolean().nullable(),
    limit: z.number().int().min(1).max(100),
  }),
});

export const adminTripMetadataResponseSchema = z.strictObject({
  trip: adminTripSummarySchema.extend({
    schemaVersion: z.number().int().positive(),
  }),
});

export const externalApiUsageServiceSummarySchema = z.strictObject({
  service: externalApiServiceSchema,
  actualCalls: z.number().int().nonnegative(),
  successCalls: z.number().int().nonnegative(),
  failedCalls: z.number().int().nonnegative(),
  blockedCalls: z.number().int().nonnegative(),
  mockCalls: z.number().int().nonnegative(),
  avgDurationMs: nullableNonnegativeIntegerSchema,
  p95DurationMs: nullableNonnegativeIntegerSchema,
  lastObservedAt: nullableIsoDatetimeSchema,
});

export const externalApiUsageBucketSchema = z.strictObject({
  start: z.iso.datetime(),
  actualCalls: z.number().int().nonnegative(),
  failedCalls: z.number().int().nonnegative(),
  blockedCalls: z.number().int().nonnegative(),
  mockCalls: z.number().int().nonnegative(),
});

export const externalApiUsageActorSummarySchema = z.strictObject({
  userId: z.uuid(),
  displayName: z.string(),
  actualCalls: z.number().int().nonnegative(),
});

export const externalApiUsageSummaryResponseSchema = z.strictObject({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  bucket: z.enum(['hour', 'day']),
  timeZone: z.literal('Asia/Seoul'),
  hasCollectedData: z.boolean(),
  totalActualCalls: z.number().int().nonnegative(),
  successCalls: z.number().int().nonnegative(),
  failedCalls: z.number().int().nonnegative(),
  blockedCalls: z.number().int().nonnegative(),
  mockCalls: z.number().int().nonnegative(),
  avgDurationMs: nullableNonnegativeIntegerSchema,
  p95DurationMs: nullableNonnegativeIntegerSchema,
  byService: z.array(externalApiUsageServiceSummarySchema),
  byBucket: z.array(externalApiUsageBucketSchema),
  perUserTop: z.array(externalApiUsageActorSummarySchema).max(20),
  coverage: z.strictObject({
    backendOutboundOnly: z.literal(true),
    browserGoogleMapsExcluded: z.literal(true),
    blockedAndMockExcludedFromActual: z.literal(true),
  }),
});

export const adminOperationServiceSchema = z.strictObject({
  service: externalApiServiceSchema,
  configured: z.boolean().nullable(),
  actualCalls: z.number().int().nonnegative(),
  failedCalls: z.number().int().nonnegative(),
  avgDurationMs: nullableNonnegativeIntegerSchema,
  lastObservedAt: nullableIsoDatetimeSchema,
  recentErrorCodes: z.array(z.string().min(1).max(100)).max(10),
});

export const adminJobMirrorSummarySchema = z.strictObject({
  service: z.enum(['troute', 'tcache']),
  available: z.boolean(),
  observedJobs: z.number().int().nonnegative(),
  runningJobs: z.number().int().nonnegative(),
  failedJobs: z.number().int().nonnegative(),
  lastUpdatedAt: nullableIsoDatetimeSchema,
});

export const adminOperationsSummaryResponseSchema = z.strictObject({
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  timeZone: z.literal('Asia/Seoul'),
  services: z.array(adminOperationServiceSchema),
  jobMirrors: z.array(adminJobMirrorSummarySchema),
});

export const adminAuditEventSchema = z.strictObject({
  id: z.uuid(),
  time: z.iso.datetime(),
  action: z.string().min(1).max(100),
  actor: z.strictObject({
    id: z.uuid(),
    displayName: z.string(),
  }),
  targetType: z.string().min(1).max(100),
  targetId: z.string().min(1).max(200),
  metadata: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});

export const adminAuditListResponseSchema = z.strictObject({
  events: z.array(adminAuditEventSchema),
  nextCursor: z.string().nullable(),
  appliedFilters: z.strictObject({
    from: nullableIsoDatetimeSchema,
    to: nullableIsoDatetimeSchema,
    action: z.string().nullable(),
    actorUserId: z.uuid().nullable(),
    limit: z.number().int().min(1).max(100),
  }),
});
