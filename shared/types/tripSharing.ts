import type { z } from 'zod';
import type {
  sharedTripSchema,
  tripShareOwnerSchema,
  tripShareCopyResponseSchema,
  tripShareSettingsSchema,
  updateTripShareRequestSchema,
  shareViewerTypeSchema,
} from '../schemas/tripSharing.js';

export type TripShareOwner = z.infer<typeof tripShareOwnerSchema>;
export type TripShareCopyResponse = z.infer<typeof tripShareCopyResponseSchema>;
export type TripShareSettings = z.infer<typeof tripShareSettingsSchema>;
export type UpdateTripShareRequest = z.infer<
  typeof updateTripShareRequestSchema
>;
export type SharedTrip = z.infer<typeof sharedTripSchema>;
export type ShareViewerType = z.infer<typeof shareViewerTypeSchema>;
