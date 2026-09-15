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

export const trouteProgressStatusSchema = z.enum(['queued', 'running']);
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
]);

export const trouteProgressPayloadSchema = z
  .strictObject({
    status: trouteProgressStatusSchema,
    stage: trouteProgressStageSchema,
    progress: z.number().int().min(0).max(100),
    message: humanMessageSchema.optional(),
  })
  .superRefine((payload, context) => {
    if (payload.stage !== 'accepted' && payload.status !== 'running') {
      context.addIssue({
        code: 'custom',
        message: 'Progress after the accepted stage must be running.',
        path: ['status'],
      });
    }
  });

export const trouteErrorPayloadSchema = z.strictObject({
  code: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/),
  message: humanMessageSchema,
  detail: z.string().max(4096).optional(),
});

const trouteEventSequenceSchema = z.number().int().min(1).max(MAX_U32);

export const trouteProgressEventSchema = z.strictObject({
  sequence: trouteEventSequenceSchema,
  type: z.literal('progress'),
  data: trouteProgressPayloadSchema,
});

export const trouteErrorEventSchema = z.strictObject({
  sequence: trouteEventSequenceSchema,
  type: z.literal('error'),
  data: trouteErrorPayloadSchema,
});

export const trouteJobEventAcceptedResponseSchema = z.strictObject({
  status: z.literal('accepted'),
});

export const trouteJobDiagnosticSchema = z.strictObject({
  code: z.literal('RESULT_MISMATCH'),
});

export function isTrouteJobTerminalStatus(
  status: z.infer<typeof trouteJobStatusSchema>,
): boolean {
  return status === 'failed' || status === 'completed';
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
    locations: z.array(trouteLocationSchema).min(1).max(500),
    start_location_id: nonEmptyStringSchema,
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

    if (!ids.has(request.start_location_id)) {
      context.addIssue({
        code: 'custom',
        message: 'The start location must exist in locations.',
        path: ['start_location_id'],
      });
    }
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

export const trouteResultEventSchema = z.strictObject({
  sequence: trouteEventSequenceSchema,
  type: z.literal('result'),
  data: trouteOptimizeResponseSchema,
});

export const trouteJobEventSchema = z.discriminatedUnion('type', [
  trouteProgressEventSchema,
  trouteErrorEventSchema,
  trouteResultEventSchema,
]);

export const trouteJobStateSchema = z.strictObject({
  job_id: trouteJobIdSchema,
  status: trouteJobStatusSchema,
  stage: trouteProgressStageSchema.nullable(),
  progress: z.number().int().min(0).max(100),
  last_message: humanMessageSchema.nullable(),
  error: trouteErrorPayloadSchema.nullable(),
  result: trouteOptimizeResponseSchema.nullable(),
  diagnostic: trouteJobDiagnosticSchema.nullable(),
  events: z.array(trouteJobEventSchema),
});
