import type { z } from 'zod';
import type {
  trouteLocationSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  trouteRouteStopSchema,
} from '../schemas/troute.js';

export type TrouteLocation = z.infer<typeof trouteLocationSchema>;
export type TrouteOptimizeRequest = z.infer<typeof trouteOptimizeRequestSchema>;
export type TrouteRouteStop = z.infer<typeof trouteRouteStopSchema>;
export type TrouteOptimizeResponse = z.infer<
  typeof trouteOptimizeResponseSchema
>;
