import type { z } from 'zod';
export type {
  Trip,
  TripInput,
  TripDay,
  TripPlace,
} from './trip.js';
import type { healthResponseSchema } from '../schemas/index.js';

export type HealthResponse = z.infer<typeof healthResponseSchema>;
