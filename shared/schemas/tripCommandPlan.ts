import { z } from 'zod';
import {
  TRIP_COMMAND_PLAN_FINGERPRINT_MAX_LENGTH,
  TRIP_COMMAND_PLAN_MAX_OPERATIONS,
  TRIP_COMMAND_PLAN_STEP_ID_MAX_LENGTH,
  TRIP_COMMAND_PLAN_VALIDATION_MESSAGE_MAX_LENGTH,
  TRIP_COMMAND_PLAN_VERSION,
} from '../constants/tripCommandPlan.js';
import { placeAutocompleteRequestSchema, placeIdSchema } from './places.js';
import {
  TRIP_DAY_MAX_PLACES,
  TRIP_MAX_DAYS,
  TRIP_PLACE_MAX_DURATION_MINUTES,
  tripClockTimeSchema,
  tripIdSchema,
  tripMemoSchema,
  tripPolylineModeSchema,
  tripTitleSchema,
} from './trip.js';

export const tripCommandPlanStepIdSchema = z
  .string()
  .min(1)
  .max(TRIP_COMMAND_PLAN_STEP_ID_MAX_LENGTH)
  .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/);

const resultReferenceSchema = z.strictObject({
  kind: z.literal('result'),
  stepId: tripCommandPlanStepIdSchema,
});

export const tripCommandPlanDayReferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('id'), id: tripIdSchema }),
  z.strictObject({
    kind: z.literal('ordinal'),
    ordinal: z.number().int().min(1).max(TRIP_MAX_DAYS),
  }),
  resultReferenceSchema,
]);

export const tripCommandPlanPlaceReferenceSchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({ kind: z.literal('id'), id: tripIdSchema }),
    z.strictObject({
      kind: z.literal('name'),
      name: tripTitleSchema,
      day: tripCommandPlanDayReferenceSchema.optional(),
    }),
    z.strictObject({
      kind: z.literal('selection'),
      ordinal: z.number().int().min(1).max(TRIP_DAY_MAX_PLACES),
    }),
    resultReferenceSchema,
  ],
);

export const tripCommandPlanPolylineReferenceSchema = z.strictObject({
  kind: z.literal('id'),
  id: tripIdSchema,
});

/** Ordinal positions are one-based user intent, not array indices. */
function createPositionSchema(maximumOrdinal: number) {
  return z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('start') }),
    z.strictObject({ kind: z.literal('end') }),
    z.strictObject({
      kind: z.literal('ordinal'),
      ordinal: z.number().int().min(1).max(maximumOrdinal),
    }),
  ]);
}

export const tripCommandPlanDayPositionSchema =
  createPositionSchema(TRIP_MAX_DAYS);
export const tripCommandPlanPlacePositionSchema =
  createPositionSchema(TRIP_DAY_MAX_PLACES);

export const tripCommandPlanAddPlaceSourceSchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({
      kind: z.literal('search'),
      query: placeAutocompleteRequestSchema.shape.input,
    }),
    z.strictObject({
      kind: z.literal('external_place_id'),
      placeId: placeIdSchema,
    }),
  ],
);

const durationSchema = z
  .number()
  .int()
  .min(0)
  .max(TRIP_PLACE_MAX_DURATION_MINUTES);

const operationFields = {
  stepId: tripCommandPlanStepIdSchema,
};

export const tripCommandPlanOperationSchema = z.discriminatedUnion('op', [
  z.strictObject({
    ...operationFields,
    op: z.literal('rename_trip'),
    title: tripTitleSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('add_day'),
    title: tripTitleSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('rename_day'),
    day: tripCommandPlanDayReferenceSchema,
    title: tripTitleSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('move_day'),
    day: tripCommandPlanDayReferenceSchema,
    position: tripCommandPlanDayPositionSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('add_place'),
    day: tripCommandPlanDayReferenceSchema,
    source: tripCommandPlanAddPlaceSourceSchema,
    position: tripCommandPlanPlacePositionSchema.optional(),
    time: tripClockTimeSchema.optional(),
    visitDurationMinutes: durationSchema.optional(),
    preferredDurationMinutes: durationSchema.optional(),
    memo: tripMemoSchema.optional(),
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('remove_place'),
    place: tripCommandPlanPlaceReferenceSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('move_place'),
    place: tripCommandPlanPlaceReferenceSchema,
    day: tripCommandPlanDayReferenceSchema,
    position: tripCommandPlanPlacePositionSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('rename_place'),
    place: tripCommandPlanPlaceReferenceSchema,
    name: tripTitleSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('set_memo'),
    place: tripCommandPlanPlaceReferenceSchema,
    memo: tripMemoSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('set_visit_time'),
    place: tripCommandPlanPlaceReferenceSchema,
    time: tripClockTimeSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('set_visit_duration'),
    place: tripCommandPlanPlaceReferenceSchema,
    minutes: durationSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('set_preferred_duration'),
    place: tripCommandPlanPlaceReferenceSchema,
    minutes: durationSchema,
  }),
  z.strictObject({
    ...operationFields,
    op: z.literal('set_polyline_mode'),
    polyline: tripCommandPlanPolylineReferenceSchema,
    mode: tripPolylineModeSchema,
  }),
]);

export const tripCommandPlanSchema = z.strictObject({
  version: z.literal(TRIP_COMMAND_PLAN_VERSION),
  base: z.strictObject({
    tripId: tripIdSchema,
    fingerprint: z
      .string()
      .min(1)
      .max(TRIP_COMMAND_PLAN_FINGERPRINT_MAX_LENGTH)
      .refine((value) => value.trim().length > 0),
  }),
  operations: z
    .array(tripCommandPlanOperationSchema)
    .min(1)
    .max(TRIP_COMMAND_PLAN_MAX_OPERATIONS),
});

export const tripCommandPlanValidationErrorCodeSchema = z.enum([
  'schema_invalid',
  'unsupported_operation',
  'unresolved_target',
  'ambiguous_target',
  'stale_plan',
  'unsafe_operation',
]);

export const tripCommandPlanValidationErrorSchema = z.strictObject({
  code: tripCommandPlanValidationErrorCodeSchema,
  message: z
    .string()
    .trim()
    .min(1)
    .max(TRIP_COMMAND_PLAN_VALIDATION_MESSAGE_MAX_LENGTH),
  stepId: tripCommandPlanStepIdSchema.optional(),
});
