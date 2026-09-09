import type { z } from 'zod';
export type {
  TripMap,
  TripMapInput,
  TripMapDay,
  TripMapPlace,
} from './tripMap.js';
import type { healthResponseSchema } from '../schemas/index.js';

export type HealthResponse = z.infer<typeof healthResponseSchema>;
