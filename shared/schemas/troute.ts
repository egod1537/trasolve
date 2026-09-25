import { z } from 'zod';

const MAX_U32 = 4_294_967_295;
export const TROUTE_MAX_DEBUG_JOB_DURATION_MS = 60_000;
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

export const trouteHealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('troute'),
});

export const trouteJobIdSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value.trim().length > 0);

const trouteKnownProgressStageSchema = z.enum([
  'accepted',
  'validating_request',
  'selecting_provider',
  'preparing_matrix',
  'fetching_travel_times',
  'building_matrix',
  'generating_candidates',
  'optimizing_route',
  'selecting_best_candidate',
  'scheduling',
  'validating_schedule',
  'finalizing_result',
]);
export const trouteProgressStageSchema = z.union([
  trouteKnownProgressStageSchema,
  z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z][a-z0-9_]*$/),
]);
export const trouteJobStatusSchema = z.enum([
  'pending',
  'running',
  'failed',
  'completed',
  'cancelled',
]);
export const trouteTravelModeSchema = z.enum([
  'TRANSIT',
  'DRIVING',
  'WALKING',
  'BICYCLING',
]);
export const trouteStartPolicySchema = z.enum(['FIXED', 'EARLIEST', 'LATEST']);

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
  place_id: z.string().max(512),
  open_time: timeOfDaySchema,
  close_time: timeOfDaySchema,
  stay_minutes: z.number().int().min(0).max(MAX_U32),
});

const trouteTravelTimeMatrixSchema = z.array(
  z.array(z.number().int().nonnegative()),
);

export const trouteDebugOptionsSchema = z.strictObject({
  min_job_duration_ms: z
    .number()
    .int()
    .min(0)
    .max(TROUTE_MAX_DEBUG_JOB_DURATION_MS)
    .optional(),
  shuffle_result_route: z.boolean().optional(),
});

export const trouteOptimizeRequestSchema = z
  .strictObject({
    job_id: trouteJobIdSchema,
    locations: z.array(trouteLocationSchema).min(2).max(500),
    start_policy: trouteStartPolicySchema.optional(),
    start_time: timeOfDaySchema.optional(),
    travel_mode: trouteTravelModeSchema.optional(),
    travel_time_matrix: trouteTravelTimeMatrixSchema.optional(),
    debug: trouteDebugOptionsSchema.optional(),
  })
  .superRefine((request, context) => {
    if (
      request.start_policy === undefined &&
      request.start_time === undefined
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Start time is required when no start policy is provided.',
        path: ['start_time'],
      });
    } else if (request.start_policy === 'FIXED') {
      if (request.start_time === undefined) {
        context.addIssue({
          code: 'custom',
          message: 'Start time is required for the FIXED start policy.',
          path: ['start_time'],
        });
      }
    }
    if (
      request.start_time !== undefined &&
      clockMinutes(request.start_time) % 10 !== 0
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Start time must use a 10-minute increment.',
        path: ['start_time'],
      });
    }

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
      for (const field of ['open_time', 'close_time'] as const) {
        if (clockMinutes(location[field]) % 10 !== 0) {
          context.addIssue({
            code: 'custom',
            message: 'Location times must use a 10-minute increment.',
            path: ['locations', index, field],
          });
        }
      }
      if (location.stay_minutes % 10 !== 0) {
        context.addIssue({
          code: 'custom',
          message: 'Stay minutes must use a 10-minute increment.',
          path: ['locations', index, 'stay_minutes'],
        });
      }
    });

    const matrix = request.travel_time_matrix;
    if (matrix === undefined) {
      request.locations.forEach((location, index) => {
        if (!nonEmptyStringSchema.safeParse(location.place_id).success) {
          context.addIssue({
            code: 'custom',
            message:
              'Place IDs must not be empty when no travel time matrix is provided.',
            path: ['locations', index, 'place_id'],
          });
        }
      });
      return;
    }

    const locationCount = request.locations.length;
    if (matrix.length !== locationCount) {
      context.addIssue({
        code: 'custom',
        message: 'Travel time matrix row count must match locations length.',
        path: ['travel_time_matrix'],
      });
    }

    matrix.forEach((row, rowIndex) => {
      if (row.length !== locationCount) {
        context.addIssue({
          code: 'custom',
          message:
            'Travel time matrix column count must match locations length.',
          path: ['travel_time_matrix', rowIndex],
        });
      }
      if (row[rowIndex] !== undefined && row[rowIndex] !== 0) {
        context.addIssue({
          code: 'custom',
          message: 'Travel time matrix diagonal values must be zero.',
          path: ['travel_time_matrix', rowIndex, rowIndex],
        });
      }
    });
  });

function clockMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export const trouteRouteStopSchema = z.object({
  location_id: z.string().refine((value) => value.trim().length > 0),
  order: z.number().int().min(0).max(MAX_U32),
  arrival_time: timeOfDaySchema,
  service_start_time: timeOfDaySchema.optional(),
  departure_time: timeOfDaySchema.optional(),
  wait_minutes: z.number().int().min(0).max(MAX_U32).optional(),
  stay_minutes: z.number().int().min(0).max(MAX_U32).optional(),
});

export const trouteSolverObjectiveScoreSchema = z.object({
  latest_start: timeOfDaySchema,
  finish_time: timeOfDaySchema,
  travel_minutes: z.number().int().min(0).max(MAX_U32),
  wait_minutes: z.number().int().min(0).max(MAX_U32),
});

export const trouteSolverCandidateSchema = z.object({
  strategy: nonEmptyStringSchema,
  best: z.boolean().default(false),
  route: z.array(nonEmptyStringSchema),
  feasible: z.boolean(),
  objective_score: trouteSolverObjectiveScoreSchema.nullable().optional(),
  elapsed_ms: z.number().nonnegative().nullable().optional(),
  error: z.string().max(4096).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const trouteOptimizeResponseSchema = z.object({
  route: z.array(trouteRouteStopSchema).min(1),
  total_travel_minutes: z.number().int().min(0).max(MAX_U32),
  solver_candidates: z.array(trouteSolverCandidateSchema).optional(),
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

const trouteJobEventEnvelopeBaseSchema = z.strictObject({
  sequence: z.number().int().nonnegative().optional(),
  updated_at: z.number().int().nonnegative().optional(),
  state: trouteJobStateSchema,
});

export const trouteJobSnapshotEventSchema = trouteJobEventEnvelopeBaseSchema;

export const trouteJobProgressEventSchema =
  trouteJobEventEnvelopeBaseSchema.superRefine((event, context) => {
    if (event.state.status !== 'pending' && event.state.status !== 'running') {
      context.addIssue({
        code: 'custom',
        message: 'Progress events require an active Job state.',
        path: ['state', 'status'],
      });
    }
  });

export const trouteJobCompletedEventSchema =
  trouteJobEventEnvelopeBaseSchema.superRefine((event, context) => {
    if (event.state.status !== 'completed' || event.state.result === null) {
      context.addIssue({
        code: 'custom',
        message: 'Completed events require a completed Job result.',
        path: ['state'],
      });
    }
  });

export const trouteJobFailedEventSchema =
  trouteJobEventEnvelopeBaseSchema.superRefine((event, context) => {
    if (event.state.status !== 'failed' || event.state.error === null) {
      context.addIssue({
        code: 'custom',
        message: 'Failed events require a failed Job error.',
        path: ['state'],
      });
    }
  });

export const trouteJobCancelledEventSchema =
  trouteJobEventEnvelopeBaseSchema.superRefine((event, context) => {
    if (event.state.status !== 'cancelled') {
      context.addIssue({
        code: 'custom',
        message: 'Cancelled events require a cancelled Job state.',
        path: ['state', 'status'],
      });
    }
  });

export const trouteJobSubmissionResponseSchema = z.strictObject({
  job_id: trouteJobIdSchema,
  status: z.literal('pending').optional(),
  created_at: z.number().int().nonnegative().optional(),
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
