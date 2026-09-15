import type { z } from 'zod';
import type {
  routeOptimizationPlaceSchema,
  routeOptimizationRequestSchema,
} from '../schemas/routeOptimization.js';

export type RouteOptimizationPlace = z.infer<
  typeof routeOptimizationPlaceSchema
>;
export type RouteOptimizationRequest = z.infer<
  typeof routeOptimizationRequestSchema
>;
