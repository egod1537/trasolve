import type { z } from 'zod';
import type {
  tripSchema,
  tripInputSchema,
  tripDaySchema,
  tripPlaceSchema,
} from '../schemas/trip.js';

export type Trip = z.infer<typeof tripSchema>;
export type TripInput = z.infer<typeof tripInputSchema>;
export type TripDay = z.infer<typeof tripDaySchema>;
export type TripPlace = z.infer<typeof tripPlaceSchema>;
