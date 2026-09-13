import type { z } from 'zod';
export type {
  Trip,
  TripInput,
  TripDay,
  TripLayerItem,
  PlaceStyle,
  PlaceStyleType,
  TripPlace,
  TripPolyline,
  TripPolylineMode,
} from './trip.js';
import type { healthResponseSchema } from '../schemas/index.js';

export type HealthResponse = z.infer<typeof healthResponseSchema>;
