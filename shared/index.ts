export { API_ROUTES, CHAT_LIMITS, TravelMode } from './constants/index.js';

export {
  tripIdSchema,
  TRIP_PLACE_MAX_DURATION_MINUTES,
  tripSchema,
  tripInputSchema,
  tripDaySchema,
  tripLayerItemSchema,
  placeStyleSchema,
  placeStyleTypeSchema,
  tripPlaceSchema,
  tripPolylineModeSchema,
  tripPolylineSchema,
  tripListSchema,
  TRIP_BODY_LIMIT,
} from './schemas/trip.js';

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
} from './types/trip.js';

export {
  routeOptimizationPlaceSchema,
  routeOptimizationRequestSchema,
} from './schemas/routeOptimization.js';

export type {
  RouteOptimizationPlace,
  RouteOptimizationRequest,
} from './types/routeOptimization.js';

export { DirectionsRequestBuilder } from './builders/DirectionsRequestBuilder.js';
export { reconcileDayRouteSegments } from './domain/tripRoutes.js';

export { healthResponseSchema } from './schemas/index.js';
export type { HealthResponse } from './types/index.js';

export {
  apiErrorSchema,
  directionsDebugDetailsSchema,
  directionsErrorResponseSchema,
  directionsRequestSchema,
  directionsResultSchema,
  routeRequestDiagnosticsSchema,
  routeUpstreamDiagnosticsSchema,
  routeLocationSchema,
} from './schemas/routes.js';

export type {
  ApiErrorResponse,
  DirectionsDebugDetails,
  DirectionsErrorResponse,
  DirectionsRequest,
  DirectionsResult,
  MapRoute,
  RouteLocation,
} from './types/routes.js';

export {
  placeIdSchema,
  placeAutocompleteRequestSchema,
  placeAutocompleteSuggestionSchema,
  placeAutocompleteResponseSchema,
  placeDetailsRequestSchema,
  placeDetailsSchema,
  placeOpeningHoursPointSchema,
  placeOpeningHoursPeriodSchema,
  placeOpeningScheduleSchema,
  placeOpeningHoursSchema,
} from './schemas/places.js';

export type {
  PlaceAutocompleteRequest,
  PlaceAutocompleteSuggestion,
  PlaceAutocompleteResponse,
  PlaceDetailsRequest,
  PlaceDetails,
  PlaceOpeningHoursPoint,
  PlaceOpeningHoursPeriod,
  PlaceOpeningSchedule,
  PlaceOpeningHours,
} from './types/places.js';

export {
  chatRoleSchema,
  chatMessageSchema,
  chatRequestSchema,
  chatResponseSchema,
} from './schemas/chat.js';

export type {
  ChatRole,
  ChatMessage,
  ChatRequest,
  ChatResponse,
} from './types/chat.js';

export {
  googleOAuthResultSchema,
  googleOAuthUserSchema,
} from './schemas/googleOAuth.js';

export type {
  GoogleOAuthResult,
  GoogleOAuthUser,
} from './types/googleOAuth.js';

export { authMeResponseSchema } from './schemas/auth.js';

export type { AuthMeResponse } from './types/auth.js';

export {
  openWebUIModelSchema,
  openWebUIModelListResponseSchema,
} from './schemas/openwebui.js';

export type {
  OpenWebUIModel,
  OpenWebUIModelListResponse,
} from './types/openwebui.js';

export {
  TROUTE_MAX_DEBUG_JOB_DURATION_MS,
  isTrouteJobTerminalStatus,
  trouteDebugOptionsSchema,
  trouteHealthResponseSchema,
  trouteErrorPayloadSchema,
  trouteJobHistoryItemSchema,
  trouteJobHistoryResponseSchema,
  trouteJobCancelledEventSchema,
  trouteJobCompletedEventSchema,
  trouteJobFailedEventSchema,
  trouteJobIdSchema,
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
} from './schemas/troute.js';

export type {
  TrouteDebugOptions,
  TrouteErrorPayload,
  TrouteJobHistoryItem,
  TrouteJobHistoryResponse,
  TrouteJobCancelledEvent,
  TrouteJobCompletedEvent,
  TrouteJobFailedEvent,
  TrouteJobProgressEvent,
  TrouteJobSnapshotEvent,
  TrouteJobState,
  TrouteJobStatus,
  TrouteJobSubmissionResponse,
  TrouteLocation,
  TrouteOptimizeRequest,
  TrouteOptimizeResponse,
  TrouteProgressStage,
  TrouteRemoteJob,
  TrouteRemoteJobListResponse,
  TrouteRemoteJobSummary,
  TrouteRemoteTimeline,
  TrouteRemoteTimelineEntry,
  TrouteRouteStop,
} from './types/troute.js';
