import type { z } from 'zod';
import type {
  tripMapSchema,
  tripMapInputSchema,
  tripMapDaySchema,
  tripMapPlaceSchema,
} from '../schemas/tripMap.js';

export type TripMap = z.infer<typeof tripMapSchema>;
export type TripMapInput = z.infer<typeof tripMapInputSchema>;
export type TripMapDay = z.infer<typeof tripMapDaySchema>;
export type TripMapPlace = z.infer<typeof tripMapPlaceSchema>;
