import { z } from 'zod';
import {
  trouteOptimizeRequestSchema,
  trouteErrorPayloadSchema,
} from './troute.js';
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const routeValidationRequestSchema = z.strictObject({
  route: z.strictObject(trouteOptimizeRequestSchema.shape),
  service_start_times: z.record(z.string().min(1).max(512), clock),
});
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
});
export type RouteValidationRequest = z.infer<
  typeof routeValidationRequestSchema
>;
export type RouteValidationResponse = z.infer<
  typeof routeValidationResponseSchema
>;
export type RouteValidationIssue = z.infer<typeof routeValidationIssueSchema>;
