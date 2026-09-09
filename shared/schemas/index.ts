import { z } from 'zod';
export {
  tripIdSchema,
  tripSchema,
  tripInputSchema,
  tripDaySchema,
  tripPlaceSchema,
  tripListSchema,
  TRIP_BODY_LIMIT,
} from './trip.js';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});
