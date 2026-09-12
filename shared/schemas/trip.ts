import { z } from 'zod';
import { placeOpeningHoursSchema } from './places.js';

// Safe as a single filename segment on Windows and Unix.
export const tripIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const title = z.string().trim().min(1).max(200);
export const TRIP_PLACE_MAX_DURATION_MINUTES = 24 * 60;
const locationSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export const placeStyleTypeSchema = z.enum([
  'general',
  'landmark',
  'restaurant',
  'cafe',
  'shopping',
  'lodging',
  'culture',
  'nature',
  'observatory',
  'transit',
  'entertainment',
  'other',
]);
export const placeStyleSchema = z.strictObject({
  type: placeStyleTypeSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const clockTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const placeFields = {
  placeId: z.string().trim().min(1).max(1024).optional(),
  name: title,
  address: z.string().max(2000).optional(),
  location: locationSchema,
  memo: z.string().max(4000).optional(),
  openingHours: placeOpeningHoursSchema.optional(),
  placeStyle: placeStyleSchema.optional(),
  durationMinutes: z
    .number()
    .int()
    .min(0)
    .max(TRIP_PLACE_MAX_DURATION_MINUTES)
    .optional(),
  time: clockTimeSchema.optional(),
};
export const tripPlaceSchema = z.strictObject({
  id: tripIdSchema,
  ...placeFields,
  order: z.number().int().min(1).max(500),
});

export const tripPolylineModeSchema = z.enum([
  'straight',
  'walking',
  'transit',
  'driving',
]);
const polylineFields = {
  fromPlaceId: tripIdSchema,
  toPlaceId: tripIdSchema,
  path: z.array(locationSchema).min(2).max(10000).optional(),
  mode: tripPolylineModeSchema.default('straight'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
};
export const tripPolylineSchema = z.strictObject({
  id: tripIdSchema,
  ...polylineFields,
  order: z.number().int().min(1).max(500),
});

export const tripLayerItemSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('place'), id: tripIdSchema }),
  z.strictObject({ type: z.literal('polyline'), id: tripIdSchema }),
]);

function legacyPolylineId(day: Record<string, unknown>, index: number): string {
  const places = Array.isArray(day.places) ? day.places : [];
  const seed = [
    typeof day.id === 'string' ? day.id : '',
    typeof day.title === 'string' ? day.title : '',
    ...places.map((place) =>
      place && typeof place === 'object' && 'id' in place
        ? String(place.id)
        : '',
    ),
  ].join(':');
  let hash = 2166136261;
  for (let offset = 0; offset < seed.length; offset += 1) {
    hash ^= seed.charCodeAt(offset);
    hash = Math.imul(hash, 16777619);
  }
  return `legacy-${(hash >>> 0).toString(16).padStart(8, '0')}-${index + 1}`;
}

function createLegacyLayerItems(day: Record<string, unknown>) {
  const entries: Array<{
    type: 'place' | 'polyline';
    id: string;
    position: number;
    sequence: number;
  }> = [];
  let sequence = 0;
  for (const [type, offset] of [
    ['place', 0],
    ['polyline', 1],
  ] as const) {
    const values = day[type === 'place' ? 'places' : 'polylines'];
    if (!Array.isArray(values)) {
      continue;
    }
    values.forEach((value, index) => {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        !('id' in value) ||
        typeof value.id !== 'string'
      ) {
        return;
      }
      const order =
        'order' in value &&
        typeof value.order === 'number' &&
        Number.isFinite(value.order)
          ? value.order
          : index + 1;
      entries.push({
        type,
        id: value.id,
        position: order * 2 + offset,
        sequence,
      });
      sequence += 1;
    });
  }
  return entries
    .sort(
      (left, right) =>
        left.position - right.position || left.sequence - right.sequence,
    )
    .map(({ type, id }) => ({ type, id }));
}

function migratePlace(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const place = value as Record<string, unknown>;
  if (!('preferredTimeRange' in place)) {
    return place;
  }
  const migrated = { ...place };
  delete migrated.preferredTimeRange;
  return migrated;
}

function migrateDay(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const day = value as Record<string, unknown>;
  let migrated = Array.isArray(day.places)
    ? { ...day, places: day.places.map(migratePlace) }
    : day;
  if (!('polylines' in migrated) && Array.isArray(migrated.places)) {
    const places = migrated.places.filter(
      (place): place is Record<string, unknown> =>
        !!place &&
        typeof place === 'object' &&
        !Array.isArray(place) &&
        typeof (place as Record<string, unknown>).id === 'string',
    );
    migrated = {
      ...migrated,
      polylines: places.slice(0, -1).map((place, index) => ({
        id: legacyPolylineId(migrated, index),
        fromPlaceId: place.id,
        toPlaceId: places[index + 1].id,
        mode: 'straight',
        order: index + 1,
      })),
    };
  }
  if ('layerItems' in migrated) {
    return migrated;
  }
  return { ...migrated, layerItems: createLegacyLayerItems(migrated) };
}

const tripDayObjectSchema = z.strictObject({
  id: tripIdSchema,
  title,
  date: z.iso.date().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  places: z.array(tripPlaceSchema).max(500),
  polylines: z.array(tripPolylineSchema).max(500).default([]),
  layerItems: z.array(tripLayerItemSchema).max(1000),
});
export const tripDaySchema = z.preprocess(migrateDay, tripDayObjectSchema);

const tripInputDaySchema = z.preprocess(
  migrateDay,
  z.strictObject({
    id: tripIdSchema.optional(),
    title,
    date: z.iso.date().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#2563eb'),
    places: z
      .array(
        tripPlaceSchema.extend({
          id: tripIdSchema.optional(),
          // Type-local array order is normalized separately from layerItems.
          order: z.number().int().min(1).max(500).optional(),
        }),
      )
      .max(500),
    polylines: z
      .array(
        tripPolylineSchema.extend({
          id: tripIdSchema.optional(),
          order: z.number().int().min(1).max(500).optional(),
        }),
      )
      .max(500)
      .default([]),
    layerItems: z.array(tripLayerItemSchema).max(1000).default([]),
  }),
);

export const tripInputSchema = z
  .strictObject({
    title,
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    days: z.array(tripInputDaySchema).max(100),
  })
  .refine(
    (trip) =>
      !trip.startDate || !trip.endDate || trip.startDate <= trip.endDate,
    {
      message: 'End date must not precede start date.',
    },
  );
export const tripSchema = z
  .strictObject({
    id: tripIdSchema,
    userId: tripIdSchema,
    title,
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    days: z.array(tripDaySchema).max(100),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .superRefine((trip, context) => {
    const days = new Set<string>();
    const places = new Set<string>();
    const polylines = new Set<string>();
    if (
      (trip.startDate && trip.endDate && trip.startDate > trip.endDate) ||
      trip.createdAt > trip.updatedAt
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid dates.' });
    }
    for (const day of trip.days) {
      if (days.has(day.id)) {
        context.addIssue({ code: 'custom', message: 'Duplicate day ID.' });
      }
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
      const dayPlaces = new Set(day.places.map((place) => place.id));
      day.polylines.forEach((polyline, index) => {
        if (
          polylines.has(polyline.id) ||
          polyline.order !== index + 1 ||
          polyline.fromPlaceId === polyline.toPlaceId ||
          !dayPlaces.has(polyline.fromPlaceId) ||
          !dayPlaces.has(polyline.toPlaceId)
        ) {
          context.addIssue({
            code: 'custom',
            message: 'Invalid polyline ID, order, or place reference.',
          });
        }
        polylines.add(polyline.id);
      });
      const layerItems = new Set<string>();
      for (const item of day.layerItems) {
        const key = `${item.type}:${item.id}`;
        const validReference =
          item.type === 'place'
            ? dayPlaces.has(item.id)
            : day.polylines.some((polyline) => polyline.id === item.id);
        if (layerItems.has(key) || !validReference) {
          context.addIssue({
            code: 'custom',
            message: 'Invalid layer item ID, type, or order.',
          });
        }
        layerItems.add(key);
      }
      if (layerItems.size !== day.places.length + day.polylines.length) {
        context.addIssue({
          code: 'custom',
          message: 'Layer items must reference every place and polyline.',
        });
      }
    }
  });
export const tripListSchema = z.array(tripSchema);
export const TRIP_BODY_LIMIT = 2 * 1024 * 1024;
