import type { z } from 'zod';
import type {
  trouteErrorEventSchema,
  trouteErrorPayloadSchema,
  trouteJobDiagnosticSchema,
  trouteJobEventAcceptedResponseSchema,
  trouteJobEventSchema,
  trouteJobStateSchema,
  trouteJobStatusSchema,
  trouteLocationSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  trouteProgressEventSchema,
  trouteProgressPayloadSchema,
  trouteProgressStageSchema,
  trouteProgressStatusSchema,
  trouteResultEventSchema,
  trouteRouteStopSchema,
} from '../schemas/troute.js';

export type TrouteProgressStatus = z.infer<typeof trouteProgressStatusSchema>;
export type TrouteProgressStage = z.infer<typeof trouteProgressStageSchema>;
export type TrouteProgressPayload = z.infer<typeof trouteProgressPayloadSchema>;
export type TrouteErrorPayload = z.infer<typeof trouteErrorPayloadSchema>;
export type TrouteJobDiagnostic = z.infer<typeof trouteJobDiagnosticSchema>;
export type TrouteProgressEvent = z.infer<typeof trouteProgressEventSchema>;
export type TrouteErrorEvent = z.infer<typeof trouteErrorEventSchema>;
export type TrouteResultEvent = z.infer<typeof trouteResultEventSchema>;
export type TrouteJobEvent = z.infer<typeof trouteJobEventSchema>;
export type TrouteJobStatus = z.infer<typeof trouteJobStatusSchema>;
export type TrouteJobState = z.infer<typeof trouteJobStateSchema>;
export type TrouteJobEventAcceptedResponse = z.infer<
  typeof trouteJobEventAcceptedResponseSchema
>;
export type TrouteLocation = z.infer<typeof trouteLocationSchema>;
export type TrouteOptimizeRequest = z.infer<typeof trouteOptimizeRequestSchema>;
export type TrouteRouteStop = z.infer<typeof trouteRouteStopSchema>;
export type TrouteOptimizeResponse = z.infer<
  typeof trouteOptimizeResponseSchema
>;
