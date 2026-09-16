import { z } from 'zod';

const MAX_U32 = 4_294_967_295;
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => value.trim().length > 0);
const humanMessageSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine((value) => value.trim().length > 0);

export const trouteJobIdSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value.trim().length > 0);

export const trouteProgressStageSchema = z.enum([
  'accepted',
  'building_matrix',
  'solving',
  'scheduling',
]);
export const trouteJobStatusSchema = z.enum([
  'pending',
  'running',
  'failed',
  'completed',
  'cancelled',
]);

export const trouteErrorPayloadSchema = z.strictObject({
  code: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/),
  message: humanMessageSchema,
  detail: z.string().max(4096).optional(),
});

export function isTrouteJobTerminalStatus(
  status: z.infer<typeof trouteJobStatusSchema>,
): boolean {
  return (
    status === 'failed' || status === 'completed' || status === 'cancelled'
  );
}

export const trouteLocationSchema = z.strictObject({
  id: nonEmptyStringSchema,
  place_id: nonEmptyStringSchema,
  open_time: timeOfDaySchema,
  close_time: timeOfDaySchema,
  stay_minutes: z.number().int().min(0).max(MAX_U32),
});

export const trouteOptimizeRequestSchema = z
  .strictObject({
    job_id: trouteJobIdSchema,
    locations: z.array(trouteLocationSchema).min(2).max(500),
    start_time: timeOfDaySchema,
  })
  .superRefine((request, context) => {
    const ids = new Set<string>();
    request.locations.forEach((location, index) => {
      if (ids.has(location.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Location IDs must be unique.',
          path: ['locations', index, 'id'],
        });
      }
      ids.add(location.id);

      if (location.open_time > location.close_time) {
        context.addIssue({
          code: 'custom',
          message: 'Opening time must not be later than closing time.',
          path: ['locations', index, 'close_time'],
        });
      }
    });
  });

export const trouteRouteStopSchema = z.object({
  location_id: z.string().refine((value) => value.trim().length > 0),
  order: z.number().int().min(0).max(MAX_U32),
  arrival_time: timeOfDaySchema,
  departure_time: timeOfDaySchema.optional(),
});

export const trouteOptimizeResponseSchema = z.object({
  route: z.array(trouteRouteStopSchema).min(1),
  total_travel_minutes: z.number().int().min(0).max(MAX_U32),
});

export const trouteJobStateSchema = z.strictObject({
  job_id: trouteJobIdSchema,
  status: trouteJobStatusSchema,
  stage: trouteProgressStageSchema.nullable(),
  progress: z.number().int().min(0).max(100),
  last_message: humanMessageSchema.nullable(),
  error: trouteErrorPayloadSchema.nullable(),
  result: trouteOptimizeResponseSchema.nullable(),
});

export const trouteJobHistoryItemSchema = z.strictObject({
  request: trouteOptimizeRequestSchema,
  state: trouteJobStateSchema,
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
  completed_at: z.number().int().nonnegative().nullable(),
});

export const trouteJobHistoryResponseSchema = z.strictObject({
  jobs: z.array(trouteJobHistoryItemSchema),
});

export const trouteRemoteJobSchema = z
  .strictObject({
    request: trouteOptimizeRequestSchema,
    job_id: trouteJobIdSchema,
    status: trouteJobStatusSchema,
    stage: trouteProgressStageSchema.nullable(),
    progress: z.number().int().min(0).max(100),
    last_message: humanMessageSchema.nullable(),
    created_at: z.number().int().nonnegative(),
    updated_at: z.number().int().nonnegative(),
    completed_at: z.number().int().nonnegative().nullable(),
    result: trouteOptimizeResponseSchema.nullable(),
    error: trouteErrorPayloadSchema.nullable(),
  })
  .superRefine((job, context) => {
    if (job.request.job_id !== job.job_id) {
      context.addIssue({
        code: 'custom',
        message: 'Remote Job ID must match request.job_id.',
        path: ['job_id'],
      });
    }
  });

export const trouteRemoteJobSummarySchema = z.strictObject({
  job_id: trouteJobIdSchema,
  status: trouteJobStatusSchema,
  created_at: z.number().int().nonnegative(),
  updated_at: z.number().int().nonnegative(),
});

export const trouteRemoteJobListResponseSchema = z.strictObject({
  jobs: z.array(trouteRemoteJobSummarySchema),
});

export const trouteRemoteTimelineEntrySchema = z.strictObject({
  id: z.string(),
  pair_id: z.string(),
  timestamp_ms: z.number().int().nonnegative(),
  direction: z.enum(['REQUEST', 'RESPONSE']),
  source: z.string(),
  target: z.string(),
  method: z.string().nullable(),
  path: z.string().nullable(),
  status: z.number().int().nullable(),
  latency_ms: z.number().nonnegative().nullable(),
  headers: z.record(z.string(), z.string()).nullable(),
  query: z.record(z.string(), z.unknown()).nullable(),
  body: z.unknown().nullable(),
  raw: z.string().nullable(),
  error: z.string().nullable(),
});

export const trouteRemoteTimelineSchema = z.strictObject({
  job_id: trouteJobIdSchema,
  entries: z.array(trouteRemoteTimelineEntrySchema),
});
