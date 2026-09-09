import { z } from 'zod';
export {
  tripMapIdSchema,
  tripMapSchema,
  tripMapInputSchema,
  tripMapDaySchema,
  tripMapPlaceSchema,
  tripMapListSchema,
  TRIP_BODY_LIMIT,
} from './tripMap.js';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});
