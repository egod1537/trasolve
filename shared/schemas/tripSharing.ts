import { z } from 'zod';
import { tripSchema } from './trip.js';

export const tripShareTokenSchema = z.uuid();

export const shareAttributionIdSchema = z
  .string()
  .regex(/^shr_[A-Za-z0-9_-]{43}$/);

export const shareViewerTypeSchema = z.enum([
  'owner_self',
  'external_authenticated',
  'anonymous',
]);

export const tripShareOwnerSchema = z.strictObject({
  displayName: z.string().max(200),
  avatarUrl: z.string().url().max(2048).nullable(),
});

export const updateTripShareRequestSchema = z
  .strictObject({
    enabled: z.boolean(),
    searchable: z.boolean(),
  })
  .refine((value) => value.enabled || !value.searchable);

export const tripShareSettingsSchema = z
  .strictObject({
    enabled: z.boolean(),
    searchable: z.boolean(),
    token: tripShareTokenSchema.nullable(),
    shareId: shareAttributionIdSchema.nullable(),
  })
  .refine(
    (value) =>
      value.enabled === (value.token !== null) &&
      value.enabled === (value.shareId !== null) &&
      (value.enabled || !value.searchable),
  );

const publicTripSchema = z
  .preprocess(
    (value) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? { ...value, userId: 'public-share' }
        : value,
    tripSchema,
  )
  .transform(({ userId: _userId, ...trip }) => trip);

export const sharedTripSchema = z.strictObject({
  trip: publicTripSchema,
  owner: tripShareOwnerSchema,
  attribution: z.strictObject({
    shareId: shareAttributionIdSchema,
    viewerType: shareViewerTypeSchema,
  }),
});
