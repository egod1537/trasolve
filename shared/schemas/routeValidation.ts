import { z } from 'zod';
import {
  trouteOptimizeRequestSchema,
  trouteErrorPayloadSchema,
} from './troute.js';
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const FAST_ROUTE_VALIDATION_MAX_LOCATIONS = 15;
export const routeValidationRequestSchema = z
  .strictObject({
    route: z.strictObject(trouteOptimizeRequestSchema.shape),
    check_feasibility: z.boolean().optional(),
    service_start_times: z.record(z.string().min(1).max(512), clock),
  })
  .refine(
    (request) =>
      !request.check_feasibility ||
      Object.keys(request.service_start_times).length === 0,
    {
      path: ['service_start_times'],
      message:
        'Fixed service times are only supported by current-order validation.',
    },
  );
export const routeValidationIssueSchema = trouteErrorPayloadSchema.extend({
  severity: z.enum(['error', 'warning']),
  blocks_optimization: z.boolean(),
  location_id: z.string().nullable(),
  failure_detail: z
    .object({ type: z.string() })
    .catchall(z.unknown())
    .nullable(),
  suggestions: trouteErrorPayloadSchema.shape.suggestions.unwrap(),
});
export const routeValidationResponseSchema = z.strictObject({
  input_valid: z.boolean(),
  schedule_feasible: z.boolean().nullable(),
  blocks_optimization: z.boolean(),
  matrix_source: z.enum(['none', 'supplied', 'euclidean', 'provider']),
  issues: z.array(routeValidationIssueSchema).max(1500),
  stops: z
    .array(
      z.strictObject({
        location_id: z.string(),
        arrival_time: clock.nullable(),
        service_start_time: clock.nullable(),
        departure_time: clock.nullable(),
        requested_service_start: clock.nullable(),
      }),
    )
    .max(500),
  feasibility: z
    .strictObject({
      status: z.enum(['FEASIBLE', 'INFEASIBLE', 'UNSUPPORTED']),
      method: z.enum(['GREEDY', 'BIT_DP']).nullable(),
      location_count: z.number().int().min(2).max(500),
      max_locations: z.literal(FAST_ROUTE_VALIDATION_MAX_LOCATIONS),
      visit_order: z.array(z.string()).max(FAST_ROUTE_VALIDATION_MAX_LOCATIONS),
    })
    .optional(),
});
export type RouteValidationRequest = z.infer<
  typeof routeValidationRequestSchema
>;
export type RouteValidationResponse = z.infer<
  typeof routeValidationResponseSchema
>;
export type RouteValidationIssue = z.infer<typeof routeValidationIssueSchema>;
