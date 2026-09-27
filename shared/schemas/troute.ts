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
export const trouteRouteProviderSchema = z.enum([
  'google',
  'kakao-mobility',
  'kakao-maps',
  'ekispert',
  'navitime',
  'otp',
]);
export const trouteProviderSelectionSourceSchema = z.enum([
  'request-override',
  'global-force',
  'country-mode',
  'country-default',
  'mode-default',
  'global-default',
  'legacy',
]);
export const trouteStartPolicySchema = z.enum(['FIXED', 'EARLIEST', 'LATEST']);

const trouteFailureDetailSchema = z
  .object({
    type: nonEmptyStringSchema,
  })
  .catchall(z.unknown());

const trouteRecoverySuggestionSchema = z
  .object({
    type: nonEmptyStringSchema,
    reason: humanMessageSchema,
    confidence: nonEmptyStringSchema.optional(),
  })
  .catchall(z.unknown());

export const trouteErrorPayloadSchema = z.strictObject({
  code: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/),
  message: humanMessageSchema,
  detail: z.string().max(4096).optional(),
  failure_detail: trouteFailureDetailSchema.optional(),
  suggestions: z.array(trouteRecoverySuggestionSchema).optional(),
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
  name: z.string().max(512).optional(),
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
  shuffle_seed: z.number().int().nonnegative().optional(),
});

export const trouteOptimizeRequestSchema = z
  .strictObject({
    job_id: trouteJobIdSchema,
    locations: z.array(trouteLocationSchema).min(2).max(500),
    start_policy: trouteStartPolicySchema.optional(),
    start_time: timeOfDaySchema.optional(),
    travel_mode: trouteTravelModeSchema.optional(),
    country_code: z.string().max(512).optional(),
    route_provider: trouteRouteProviderSchema.optional(),
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

export const trouteRouteStopSchema = z.strictObject({
  location_id: nonEmptyStringSchema,
  order: z.number().int().min(0).max(MAX_U32),
  arrival_time: timeOfDaySchema,
  service_start_time: timeOfDaySchema.optional(),
  departure_time: timeOfDaySchema.optional(),
  wait_minutes: z.number().int().min(0).max(MAX_U32).optional(),
  stay_minutes: z.number().int().min(0).max(MAX_U32).optional(),
});

export const trouteSolverObjectiveScoreSchema = z.strictObject({
  latest_start: timeOfDaySchema,
  start_time: timeOfDaySchema.optional(),
  finish_time: timeOfDaySchema,
  travel_minutes: z.number().int().min(0).max(MAX_U32),
  wait_minutes: z.number().int().min(0).max(MAX_U32),
});

const trouteClusterDiagnosticSchema = z.strictObject({
  cluster: z.number().int().nonnegative(),
  members: z.array(z.string()),
  route: z.array(z.string()),
  entry: z.string().optional(),
  exit: z.string().optional(),
  state_count: z.number().int().nonnegative(),
  frontier_state_count: z.number().int().nonnegative(),
});

const trouteMstEdgeDiagnosticSchema = z.strictObject({
  from: z.string(),
  to: z.string(),
  distance: z.number().int().nonnegative(),
});

const trouteMatchingPairDiagnosticSchema = z.strictObject({
  left: z.string(),
  right: z.string(),
  distance: z.number().int().nonnegative(),
});

const optionalCountSchema = z.number().int().nonnegative().optional();
const trouteSolverCandidateMetadataSchema = z.strictObject({
  state_count: optionalCountSchema,
  frontier_state_count: optionalCountSchema,
  frontier_cell_count: optionalCountSchema,
  cluster_count: optionalCountSchema,
  cluster_sizes: z.array(z.number().int().nonnegative()).optional(),
  cluster_strategy: z.string().optional(),
  cluster_order_strategy: z.string().optional(),
  cluster_order: z.array(z.number().int().nonnegative()).optional(),
  cluster_details: z.array(trouteClusterDiagnosticSchema).optional(),
  score_before_improvement: optionalCountSchema,
  score_after_improvement: optionalCountSchema,
  improvement_strategy: z.string().optional(),
  swap_enabled: z.boolean().optional(),
  relocate_enabled: z.boolean().optional(),
  two_opt_enabled: z.boolean().optional(),
  symmetric_distance_strategy: z.string().optional(),
  mst_cost: optionalCountSchema,
  mst_edge_count: optionalCountSchema,
  mst_edges: z.array(trouteMstEdgeDiagnosticSchema).optional(),
  euler_tour: z.array(z.string()).optional(),
  shortcut_route: z.array(z.string()).optional(),
  odd_vertices: z.array(z.string()).optional(),
  odd_vertex_count: optionalCountSchema,
  matching_strategy: z.string().optional(),
  matching_cost: optionalCountSchema,
  matching_pairs: z.array(trouteMatchingPairDiagnosticSchema).optional(),
  initial_strategy: z.string().optional(),
  initial_route: z.array(z.string()).optional(),
  final_route: z.array(z.string()).optional(),
  initial_score: optionalCountSchema,
  final_score: optionalCountSchema,
  initial_temperature: z.string().optional(),
  final_temperature: z.string().optional(),
  cooling_rate: z.string().optional(),
  swap_move_count: optionalCountSchema,
  relocate_move_count: optionalCountSchema,
  two_opt_move_count: optionalCountSchema,
  accepted_worse_moves: optionalCountSchema,
  infeasible_candidates: optionalCountSchema,
  accepted_infeasible_moves: optionalCountSchema,
  best_feasible: z.boolean().optional(),
  iteration_count: optionalCountSchema,
  accepted_moves: optionalCountSchema,
  improved_moves: optionalCountSchema,
  seed: optionalCountSchema,
  improved_global_best: z.boolean().optional(),
  timed_out: z.boolean(),
  error: z.string().optional(),
});

const trouteSolverDiagnosticsSchema = z.strictObject({
  total_budget_ms: z.number().int().nonnegative(),
  total_elapsed_ms: z.number().int().nonnegative(),
  baseline_elapsed_ms: z.number().int().nonnegative(),
  sa_elapsed_ms: z.number().int().nonnegative(),
  sa_run_count: z.number().int().nonnegative(),
  global_best_updates: z.number().int().nonnegative(),
  termination_reason: z.string(),
});

export const trouteSolverCandidateSchema = z.strictObject({
  strategy: nonEmptyStringSchema,
  best: z.boolean(),
  route: z.array(nonEmptyStringSchema),
  feasible: z.boolean(),
  objective_score: trouteSolverObjectiveScoreSchema.optional(),
  elapsed_ms: z.number().int().nonnegative(),
  metadata: trouteSolverCandidateMetadataSchema,
});

export const trouteOptimizeResponseSchema = z.strictObject({
  route: z.array(trouteRouteStopSchema).min(1),
  total_travel_minutes: z.number().int().min(0).max(MAX_U32),
  start_policy: trouteStartPolicySchema.optional(),
  selected_start_time: timeOfDaySchema.optional(),
  solver_candidates: z.array(trouteSolverCandidateSchema).optional(),
  solver_diagnostics: trouteSolverDiagnosticsSchema.optional(),
  selected_provider: trouteRouteProviderSchema.optional(),
  provider_selection_reason: z.string().optional(),
  provider_selection_source: trouteProviderSelectionSourceSchema.optional(),
  country_code: z.string().optional(),
  mode: trouteTravelModeSchema.optional(),
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

export const trouteLegacyFlatJobEventSchema = z.strictObject({
  sequence: z.number().int().nonnegative().optional(),
  request: trouteOptimizeRequestSchema.optional(),
  job_id: trouteJobIdSchema,
  status: trouteJobStatusSchema,
  stage: trouteProgressStageSchema.nullable(),
  progress: z.number().int().min(0).max(100),
  last_message: humanMessageSchema.nullable(),
  created_at: z.number().int().nonnegative().optional(),
  updated_at: z.number().int().nonnegative().optional(),
  completed_at: z.number().int().nonnegative().nullable().optional(),
  result: trouteOptimizeResponseSchema.nullable().optional(),
  error: trouteErrorPayloadSchema.nullable().optional(),
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
