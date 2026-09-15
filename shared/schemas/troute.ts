import { z } from 'zod';

const MAX_U32 = 4_294_967_295;
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => value.trim().length > 0);

export const trouteLocationSchema = z.strictObject({
  id: nonEmptyStringSchema,
  place_id: nonEmptyStringSchema,
  open_time: timeOfDaySchema,
  close_time: timeOfDaySchema,
  stay_minutes: z.number().int().min(0).max(MAX_U32),
});

export const trouteOptimizeRequestSchema = z
  .strictObject({
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
