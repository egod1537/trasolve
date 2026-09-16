import { z } from 'zod';
import { placeOpeningHoursSchema } from './places.js';
import { tripIdSchema, TRIP_PLACE_MAX_DURATION_MINUTES } from './trip.js';

const routeOptimizationLocationSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const routeOptimizationPlaceSchema = z.strictObject({
  id: tripIdSchema,
  name: z.string().trim().min(1).max(200),
  location: routeOptimizationLocationSchema,
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  visitDurationMinutes: z
    .number()
    .int()
    .min(0)
    .max(TRIP_PLACE_MAX_DURATION_MINUTES)
    .nullable(),
  preferredDurationMinutes: z
    .number()
    .int()
    .min(0)
    .max(TRIP_PLACE_MAX_DURATION_MINUTES)
    .nullable(),
  openingHours: placeOpeningHoursSchema.nullable(),
});

export const routeOptimizationRequestSchema = z.strictObject({
  dayId: tripIdSchema,
  includeStayDuration: z.boolean(),
  places: z.array(routeOptimizationPlaceSchema).max(500),
});
