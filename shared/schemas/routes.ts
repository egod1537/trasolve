import { z } from 'zod';
import { TravelMode } from '../constants/travelMode.js';

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const routeLocationSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('place'),
    placeId: z.string().trim().min(1).max(512),
  }),
  z.strictObject({
    type: z.literal('coordinates'),
    ...coordinatesSchema.shape,
  }),
  z.strictObject({
    type: z.literal('address'),
    address: z.string().trim().min(1).max(1024),
  }),
]);

export const directionsRequestSchema = z.strictObject({
  origin: routeLocationSchema,
  destination: routeLocationSchema,
  travelMode: z.enum(TravelMode).optional(),
  intermediates: z.array(routeLocationSchema).max(25).optional(),
  computeAlternativeRoutes: z.boolean().optional(),
});

export const mapRouteSchema = z.object({
  description: z.string(),
  distanceMeters: z.number().nonnegative().nullable(),
  durationMillis: z.number().nonnegative().nullable(),
  path: z.array(coordinatesSchema),
  bounds: z
    .object({
      north: z.number(),
      south: z.number(),
      east: z.number(),
      west: z.number(),
    })
    .nullable(),
  warnings: z.array(z.string()),
});

export const directionsResultSchema = z.object({
  request: directionsRequestSchema,
  routes: z.array(mapRouteSchema),
  /** Google REST response, or ordered segment requests/responses for transit waypoints. */
  rawResponse: z.unknown(),
});

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
