import type { z } from 'zod';
import type {
  tripCommandPlanAddPlaceSourceSchema,
  tripCommandPlanDayPositionSchema,
  tripCommandPlanDayReferenceSchema,
  tripCommandPlanOperationSchema,
  tripCommandPlanPlaceReferenceSchema,
  tripCommandPlanPolylineReferenceSchema,
  tripCommandPlanPlacePositionSchema,
  tripCommandPlanSchema,
  tripCommandPlanStepIdSchema,
  tripCommandPlanValidationErrorCodeSchema,
  tripCommandPlanValidationErrorSchema,
} from '../schemas/tripCommandPlan.js';

export type TripCommandPlanStepId = z.infer<typeof tripCommandPlanStepIdSchema>;
export type TripCommandPlanDayReference = z.infer<
  typeof tripCommandPlanDayReferenceSchema
>;
export type TripCommandPlanPlaceReference = z.infer<
  typeof tripCommandPlanPlaceReferenceSchema
>;
export type TripCommandPlanPolylineReference = z.infer<
  typeof tripCommandPlanPolylineReferenceSchema
>;
export type TripCommandPlanDayPosition = z.infer<
  typeof tripCommandPlanDayPositionSchema
>;
export type TripCommandPlanPlacePosition = z.infer<
  typeof tripCommandPlanPlacePositionSchema
>;
export type TripCommandPlanAddPlaceSource = z.infer<
  typeof tripCommandPlanAddPlaceSourceSchema
>;
export type TripCommandPlanOperation = z.infer<
  typeof tripCommandPlanOperationSchema
>;
export type TripCommandPlan = z.infer<typeof tripCommandPlanSchema>;
export type TripCommandPlanValidationErrorCode = z.infer<
  typeof tripCommandPlanValidationErrorCodeSchema
>;
export type TripCommandPlanValidationError = z.infer<
  typeof tripCommandPlanValidationErrorSchema
>;
