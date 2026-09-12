import type { z } from 'zod';
import type {
  apiErrorSchema,
  directionsDebugDetailsSchema,
  directionsErrorResponseSchema,
  directionsRequestSchema,
  directionsResultSchema,
  mapRouteSchema,
  routeLocationSchema,
} from '../schemas/routes.js';

export type RouteLocation = z.infer<typeof routeLocationSchema>;
export type DirectionsRequest = z.infer<typeof directionsRequestSchema>;
export type DirectionsResult = z.infer<typeof directionsResultSchema>;
export type DirectionsDebugDetails = z.infer<
  typeof directionsDebugDetailsSchema
>;
export type DirectionsErrorResponse = z.infer<
  typeof directionsErrorResponseSchema
>;
export type MapRoute = z.infer<typeof mapRouteSchema>;
export type { TravelMode } from '../constants/travelMode.js';
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>;
