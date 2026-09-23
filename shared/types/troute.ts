import type { z } from 'zod';
import type {
  trouteErrorPayloadSchema,
  trouteDebugOptionsSchema,
  trouteJobHistoryItemSchema,
  trouteJobHistoryResponseSchema,
  trouteJobCancelledEventSchema,
  trouteJobCompletedEventSchema,
  trouteJobFailedEventSchema,
  trouteJobProgressEventSchema,
  trouteJobSnapshotEventSchema,
  trouteJobStateSchema,
  trouteJobStatusSchema,
  trouteJobSubmissionResponseSchema,
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
  trouteTravelModeSchema,
} from '../schemas/troute.js';

export type TrouteProgressStage = z.infer<typeof trouteProgressStageSchema>;
export type TrouteDebugOptions = z.infer<typeof trouteDebugOptionsSchema>;
export type TrouteErrorPayload = z.infer<typeof trouteErrorPayloadSchema>;
export type TrouteJobStatus = z.infer<typeof trouteJobStatusSchema>;
export type TrouteJobState = z.infer<typeof trouteJobStateSchema>;
export type TrouteJobSnapshotEvent = z.infer<
  typeof trouteJobSnapshotEventSchema
>;
export type TrouteJobProgressEvent = z.infer<
  typeof trouteJobProgressEventSchema
>;
export type TrouteJobCompletedEvent = z.infer<
  typeof trouteJobCompletedEventSchema
>;
export type TrouteJobFailedEvent = z.infer<typeof trouteJobFailedEventSchema>;
export type TrouteJobCancelledEvent = z.infer<
  typeof trouteJobCancelledEventSchema
>;
export type TrouteJobSubmissionResponse = z.infer<
  typeof trouteJobSubmissionResponseSchema
>;
export type TrouteJobHistoryItem = z.infer<typeof trouteJobHistoryItemSchema>;
export type TrouteJobHistoryResponse = z.infer<
  typeof trouteJobHistoryResponseSchema
>;
export type TrouteLocation = z.infer<typeof trouteLocationSchema>;
export type TrouteOptimizeRequest = z.infer<typeof trouteOptimizeRequestSchema>;
export type TrouteTravelMode = z.infer<typeof trouteTravelModeSchema>;
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
