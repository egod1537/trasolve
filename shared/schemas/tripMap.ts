import { z } from 'zod';

// Safe as a single filename segment on Windows and Unix.
export const tripMapIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const title = z.string().trim().min(1).max(200);
const placeFields = {
  placeId: z.string().trim().min(1).max(1024).optional(),
  name: title,
  address: z.string().max(2000).optional(),
  location: z.strictObject({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  memo: z.string().max(4000).optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
};
export const tripMapPlaceSchema = z.strictObject({
  id: tripMapIdSchema,
  ...placeFields,
  order: z.number().int().min(1).max(500),
});
export const tripMapDaySchema = z.strictObject({
  id: tripMapIdSchema,
  title,
  date: z.iso.date().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  places: z.array(tripMapPlaceSchema).max(500),
});
export const tripMapInputSchema = z
  .strictObject({
    title,
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    days: z
      .array(
        tripMapDaySchema.extend({
          id: tripMapIdSchema.optional(),
          color: tripMapDaySchema.shape.color.default('#2563eb'),
          places: z
            .array(
              tripMapPlaceSchema.extend({
                id: tripMapIdSchema.optional(),
                // Array order is authoritative; the controller recomputes 1-based order.
                order: z.number().int().min(1).max(500).optional(),
              }),
            )
            .max(500),
        }),
      )
      .max(100),
  })
  .refine(
    (trip) =>
      !trip.startDate || !trip.endDate || trip.startDate <= trip.endDate,
    {
      message: 'End date must not precede start date.',
    },
  );
export const tripMapSchema = z
  .strictObject({
    id: tripMapIdSchema,
    userId: tripMapIdSchema,
    title,
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    days: z.array(tripMapDaySchema).max(100),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((trip, context) => {
    const days = new Set<string>();
    const places = new Set<string>();
    if (
      (trip.startDate && trip.endDate && trip.startDate > trip.endDate) ||
      trip.createdAt > trip.updatedAt
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid dates.' });
    }
    for (const day of trip.days) {
      if (days.has(day.id))
        context.addIssue({ code: 'custom', message: 'Duplicate day ID.' });
      days.add(day.id);
      day.places.forEach((place, index) => {
        if (places.has(place.id) || place.order !== index + 1) {
          context.addIssue({
            code: 'custom',
            message: 'Invalid place ID or order.',
          });
        }
        places.add(place.id);
      });
    }
  });
export const tripMapListSchema = z.array(tripMapSchema);
export const TRIP_BODY_LIMIT = 2 * 1024 * 1024;
