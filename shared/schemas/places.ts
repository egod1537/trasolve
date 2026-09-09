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
});

export const placeAutocompleteResponseSchema = z.object({
  suggestions: z.array(placeAutocompleteSuggestionSchema),
});

export const placeDetailsRequestSchema = z.strictObject({
  placeId: placeIdSchema,
  ...placeOptions,
});

export const placeDetailsSchema = z.object({
  id: placeIdSchema,
  name: z.string().min(1),
  address: z.string().optional(),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});
