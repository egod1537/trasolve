import { z } from 'zod';

export const placeIdSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

const placeOptions = {
  languageCode: z
    .string()
    .regex(/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/)
    .max(35)
    .optional(),
  regionCode: z
    .string()
    .regex(/^[a-zA-Z]{2}$/)
    .optional(),
  sessionToken: z
    .string()
    .min(1)
    .max(36)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
};

export const placeAutocompleteRequestSchema = z.strictObject({
  input: z.string().trim().min(2).max(1024),
  ...placeOptions,
  locationBias: z
    .strictObject({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radiusMeters: z.number().min(0).max(50000),
    })
    .optional(),
});

export const placeAutocompleteSuggestionSchema = z.object({
  placeId: placeIdSchema,
  text: z.string().min(1),
  secondaryText: z.string(),
  types: z.array(z.string().min(1).max(100)).max(32).default([]),
});

export const placeAutocompleteResponseSchema = z.object({
  suggestions: z.array(placeAutocompleteSuggestionSchema),
});

export const placeDetailsRequestSchema = z.strictObject({
  placeId: placeIdSchema,
  ...placeOptions,
});

export const placeOpeningHoursPointSchema = z.object({
  date: z
    .object({
      year: z.number().int().min(1).max(9999),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
    })
    .optional(),
  day: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

export const placeOpeningHoursPeriodSchema = z.object({
  open: placeOpeningHoursPointSchema,
  close: placeOpeningHoursPointSchema.optional(),
});

export const placeOpeningScheduleSchema = z.object({
  openNow: z.boolean().optional(),
  periods: z.array(placeOpeningHoursPeriodSchema).max(64).optional(),
  weekdayDescriptions: z.array(z.string().min(1)).max(7).optional(),
  nextOpenTime: z.string().datetime({ offset: true }).optional(),
  nextCloseTime: z.string().datetime({ offset: true }).optional(),
});

export const placeOpeningHoursSchema = z.object({
  timeZone: z.string().min(1).max(100).optional(),
  utcOffsetMinutes: z.number().int().min(-840).max(840).optional(),
  current: placeOpeningScheduleSchema.optional(),
  regular: placeOpeningScheduleSchema.optional(),
});

export const placeDetailsSchema = z.object({
  id: placeIdSchema,
  name: z.string().min(1),
  address: z.string().optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  rating: z.number().min(1).max(5).optional(),
  userRatingCount: z.number().int().nonnegative().optional(),
  website: z
    .string()
    .url()
    .regex(/^https?:\/\//i)
    .optional(),
  phoneNumber: z.string().min(1).optional(),
  googleMapsUrl: z
    .string()
    .url()
    .regex(/^https?:\/\//i)
    .optional(),
  category: z.string().min(1).optional(),
  openingHours: placeOpeningHoursSchema.optional(),
});
