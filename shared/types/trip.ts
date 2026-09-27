import type { z } from 'zod';
import type {
  tripSchema,
  tripInputSchema,
  tripDaySchema,
  tripLayerItemSchema,
  placeStyleSchema,
  placeStyleTypeSchema,
  tripPlaceSchema,
  tripPolylineModeSchema,
  tripPolylineSchema,
} from '../schemas/trip.js';

export type Trip = z.infer<typeof tripSchema>;
export type TripInput = z.infer<typeof tripInputSchema>;
export type TripDay = z.infer<typeof tripDaySchema>;
export type TripLayerItem = z.infer<typeof tripLayerItemSchema>;
export type PlaceStyle = z.infer<typeof placeStyleSchema>;
export type PlaceStyleType = z.infer<typeof placeStyleTypeSchema>;
export type TripPlace = z.infer<typeof tripPlaceSchema>;
export type TripPolylineMode = z.infer<typeof tripPolylineModeSchema>;
export type TripPolyline = z.infer<typeof tripPolylineSchema>;

export type TripScheduleStopUpdate = {
  placeId: string;
  time: string;
  visitDurationMinutes?: number;
};

export type TripScheduleUpdate = {
  placeIds: readonly string[];
  stops: readonly TripScheduleStopUpdate[];
  expectedStartPlaceId: string;
  expectedEndPlaceId: string;
};
