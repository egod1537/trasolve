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

export const routeRequestDiagnosticsSchema = z.strictObject({
  travelMode: z.enum(TravelMode),
  originType: z.enum(['address', 'place', 'coordinates']),
  destinationType: z.enum(['address', 'place', 'coordinates']),
  computeAlternativeRoutes: z.boolean(),
  intermediatesCount: z.number().int().nonnegative(),
});

export const routeUpstreamDiagnosticsSchema = z.strictObject({
  httpStatus: z.number().int().min(100).max(599),
  status: z.string().nullable(),
  message: z.string().nullable(),
  requestBody: z.unknown(),
  rawErrorBody: z.unknown().optional(),
});

export const directionsDebugDetailsSchema = z.strictObject({
  request: routeRequestDiagnosticsSchema,
  upstream: routeUpstreamDiagnosticsSchema,
});

const mapRouteFareSchema = z.object({
  amount: z.number().nonnegative(),
  currencyCode: z.string().trim().min(1),
});

const mapRouteTransitDetailsSchema = z.object({
  departureStop: z.string().nullable(),
  arrivalStop: z.string().nullable(),
  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  lineName: z.string().nullable(),
  lineShortName: z.string().nullable(),
  headsign: z.string().nullable(),
  stopCount: z.number().int().nonnegative().nullable(),
  vehicleType: z.string().nullable(),
});

const mapRouteStepSchema = z.object({
  travelMode: z.string().nullable(),
  distanceMeters: z.number().nonnegative().nullable(),
  durationMillis: z.number().nonnegative().nullable(),
  instruction: z.string().nullable(),
  startLocation: coordinatesSchema.nullable(),
  endLocation: coordinatesSchema.nullable(),
  transitDetails: mapRouteTransitDetailsSchema.nullable(),
});

const mapRouteLegSchema = z.object({
  distanceMeters: z.number().nonnegative().nullable(),
  durationMillis: z.number().nonnegative().nullable(),
  startLocation: coordinatesSchema.nullable(),
  endLocation: coordinatesSchema.nullable(),
  steps: z.array(mapRouteStepSchema),
});

export const mapRouteSchema = z.object({
  description: z.string(),
  distanceMeters: z.number().nonnegative().nullable(),
  durationMillis: z.number().nonnegative().nullable(),
  fare: mapRouteFareSchema.nullable(),
  legs: z.array(mapRouteLegSchema),
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
  debug: directionsDebugDetailsSchema.optional(),
});

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export const directionsErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: directionsDebugDetailsSchema.optional(),
  }),
});
