import type { z } from 'zod';
import type {
  trouteErrorPayloadSchema,
  trouteJobHistoryItemSchema,
  trouteJobHistoryResponseSchema,
  trouteJobStateSchema,
  trouteJobStatusSchema,
  trouteLocationSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  trouteProgressStageSchema,
  trouteRemoteJobListResponseSchema,
  trouteRemoteJobSchema,
  trouteRemoteJobSummarySchema,
  trouteRemoteTimelineEntrySchema,
  trouteRemoteTimelineSchema,
  trouteRouteStopSchema,
} from '../schemas/troute.js';

export type TrouteProgressStage = z.infer<typeof trouteProgressStageSchema>;
export type TrouteErrorPayload = z.infer<typeof trouteErrorPayloadSchema>;
export type TrouteJobStatus = z.infer<typeof trouteJobStatusSchema>;
export type TrouteJobState = z.infer<typeof trouteJobStateSchema>;
export type TrouteJobHistoryItem = z.infer<typeof trouteJobHistoryItemSchema>;
export type TrouteJobHistoryResponse = z.infer<
  typeof trouteJobHistoryResponseSchema
>;
export type TrouteLocation = z.infer<typeof trouteLocationSchema>;
export type TrouteOptimizeRequest = z.infer<typeof trouteOptimizeRequestSchema>;
export type TrouteRouteStop = z.infer<typeof trouteRouteStopSchema>;
export type TrouteOptimizeResponse = z.infer<
  typeof trouteOptimizeResponseSchema
>;
export type TrouteRemoteJob = z.infer<typeof trouteRemoteJobSchema>;
export type TrouteRemoteJobSummary = z.infer<
  typeof trouteRemoteJobSummarySchema
>;
export type TrouteRemoteJobListResponse = z.infer<
  typeof trouteRemoteJobListResponseSchema
>;
export type TrouteRemoteTimelineEntry = z.infer<
  typeof trouteRemoteTimelineEntrySchema
>;
export type TrouteRemoteTimeline = z.infer<typeof trouteRemoteTimelineSchema>;
