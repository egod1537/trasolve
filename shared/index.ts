export {
  API_ROUTE_SUFFIXES,
  API_ROUTES,
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  CHAT_LIMITS,
  GOOGLE_MAPS_DEFAULT_LANGUAGE_CODE,
  GOOGLE_MAPS_LANGUAGE_CODES,
  GOOGLE_MAPS_REGION_CODE,
  TRIP_COMMAND_PLAN_FINGERPRINT_MAX_LENGTH,
  TRIP_COMMAND_PLAN_MAX_OPERATIONS,
  TRIP_COMMAND_PLAN_STEP_ID_MAX_LENGTH,
  TRIP_COMMAND_PLAN_VALIDATION_MESSAGE_MAX_LENGTH,
  TRIP_COMMAND_PLAN_VERSION,
  TravelMode,
  buildAnalyticsFunnelApiRoute,
  buildAnalyticsSessionEventsRoute,
  buildSharedTripApiRoute,
  buildTripShareApiRoute,
  getGoogleMapsLocale,
  type GoogleMapsLanguageCode,
  type GoogleMapsLocale,
  type GoogleMapsRegionCode,
} from './constants/index.js';

export {
  googleMapsLanguageCodeSchema,
  googleMapsRegionCodeSchema,
} from './schemas/googleMapsLocale.js';

export {
  tripIdSchema,
  TRIP_DAY_MAX_PLACES,
  TRIP_MAX_DAYS,
  TRIP_PLACE_MAX_DURATION_MINUTES,
  tripClockTimeSchema,
  tripMemoSchema,
  tripTitleSchema,
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
  TripScheduleStopUpdate,
  TripScheduleUpdate,
} from './types/trip.js';

export {
  sharedTripSchema,
  tripShareOwnerSchema,
  tripShareSettingsSchema,
  tripShareTokenSchema,
  shareAttributionIdSchema,
  shareViewerTypeSchema,
  updateTripShareRequestSchema,
} from './schemas/tripSharing.js';

export type {
  SharedTrip,
  TripShareOwner,
  TripShareSettings,
  UpdateTripShareRequest,
  ShareViewerType,
} from './types/tripSharing.js';

export {
  tripCommandPlanAddPlaceSourceSchema,
  tripCommandPlanDayPositionSchema,
  tripCommandPlanDayReferenceSchema,
  tripCommandPlanOperationSchema,
  tripCommandPlanPlaceReferenceSchema,
  tripCommandPlanPolylineReferenceSchema,
  tripCommandPlanPlacePositionSchema,
  tripCommandPlanSchema,
  tripCommandPlanStepIdSchema,
  tripCommandPlanValidationErrorCodeSchema,
  tripCommandPlanValidationErrorSchema,
} from './schemas/tripCommandPlan.js';

export type {
  TripCommandPlan,
  TripCommandPlanAddPlaceSource,
  TripCommandPlanDayPosition,
  TripCommandPlanDayReference,
  TripCommandPlanOperation,
  TripCommandPlanPlaceReference,
  TripCommandPlanPolylineReference,
  TripCommandPlanPlacePosition,
  TripCommandPlanStepId,
  TripCommandPlanValidationError,
  TripCommandPlanValidationErrorCode,
} from './types/tripCommandPlan.js';

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
  googleOAuthProfileSchema,
  googleOAuthResultSchema,
} from './schemas/googleOAuth.js';

export type {
  GoogleOAuthProfile,
  GoogleOAuthResult,
} from './types/googleOAuth.js';

export { authMeResponseSchema, authUserSchema } from './schemas/auth.js';

export type { AuthMeResponse, AuthUser } from './types/auth.js';

export {
  openWebUIModelSchema,
  openWebUIModelListResponseSchema,
} from './schemas/openwebui.js';

export type {
  OpenWebUIModel,
  OpenWebUIModelListResponse,
} from './types/openwebui.js';

export {
  ANALYTICS_EVENT_BODY_LIMIT,
  ANALYTICS_DOMAIN_EVENT_TYPES,
  ANALYTICS_DURATION_BUCKETS,
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_LOCALES,
  ANALYTICS_METADATA_SOURCES,
  analyticsDomainEventTypeSchema,
  analyticsEventPageSchema,
  analyticsEventMetadataSchema,
  analyticsEventRequestMetadataSchema,
  analyticsEventRequestSchema,
  analyticsEventSchema,
  analyticsEventTypeSchema,
  analyticsFlowResponseSchema,
  analyticsLocaleSchema,
  analyticsOverviewResponseSchema,
  analyticsScreenSchema,
  analyticsSessionPageSchema,
  analyticsSessionSummarySchema,
  analyticsTargetSchema,
} from './schemas/analytics.js';

export {
  analyticsFunnelListResponseSchema,
  analyticsFunnelResultResponseSchema,
  funnelAggregationFiltersSchema,
  funnelDefinitionSchema,
  funnelResultSchema,
  funnelStepConditionSchema,
  funnelStepResultSchema,
  funnelStepSchema,
  tripShareAttributionResultSchema,
} from './schemas/analyticsFunnel.js';

export type {
  AnalyticsEvent,
  AnalyticsEventPage,
  AnalyticsEventMetadata,
  AnalyticsEventRequestMetadata,
  AnalyticsEventRequest,
  AnalyticsDomainEventType,
  AnalyticsFlowDomainEventNode,
  AnalyticsFlowEdge,
  AnalyticsFlowNode,
  AnalyticsFlowNodeMode,
  AnalyticsFlowResult,
  AnalyticsFlowResponse,
  AnalyticsFlowScreenNode,
  AnalyticsFlowSummary,
  AnalyticsLocale,
  AnalyticsFunnelStageResult,
  AnalyticsFunnelTransitionResult,
  AnalyticsQualityAnalysisResult,
  AnalyticsQualitySummary,
  AnalyticsOverviewResponse,
  AnalyticsScreen,
  AnalyticsSessionPage,
  AnalyticsSessionSummary,
  AnalyticsTarget,
  AnalyticsEventType,
} from './types/analytics.js';

export type {
  AnalyticsFunnelListResponse,
  AnalyticsFunnelResultResponse,
  FunnelAggregationFilters,
  FunnelDefinition,
  FunnelMatchedStep,
  FunnelProgressionResult,
  FunnelResult,
  FunnelSessionProgression,
  FunnelStep,
  FunnelStepCondition,
  FunnelStepResult,
  TripShareAttributionResult,
} from './types/analyticsFunnel.js';

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
  trouteLegacyFlatJobEventSchema,
  trouteJobProgressEventSchema,
  trouteJobSnapshotEventSchema,
  trouteJobStateSchema,
  trouteJobStatusSchema,
  trouteJobSubmissionResponseSchema,
  trouteLocationSchema,
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  trouteProgressStageSchema,
  trouteProviderSelectionSourceSchema,
  trouteRemoteJobListResponseSchema,
  trouteRemoteJobSchema,
  trouteRemoteJobSummarySchema,
  trouteRemoteTimelineEntrySchema,
  trouteRemoteTimelineSchema,
  trouteRouteProviderSchema,
  trouteRouteStopSchema,
  trouteSolverCandidateSchema,
  trouteSolverObjectiveScoreSchema,
  trouteStartPolicySchema,
  trouteTravelModeSchema,
} from './schemas/troute.js';

export type {
  TrouteDebugOptions,
  TrouteErrorPayload,
  TrouteJobHistoryItem,
  TrouteJobHistoryResponse,
  TrouteJobCancelledEvent,
  TrouteJobCompletedEvent,
  TrouteJobFailedEvent,
  TrouteLegacyFlatJobEvent,
  TrouteJobProgressEvent,
  TrouteJobSnapshotEvent,
  TrouteJobState,
  TrouteJobStatus,
  TrouteJobSubmissionResponse,
  TrouteLocation,
  TrouteOptimizeRequest,
  TrouteOptimizeResponse,
  TrouteProgressStage,
  TrouteProviderSelectionSource,
  TrouteRemoteJob,
  TrouteRemoteJobListResponse,
  TrouteRemoteJobSummary,
  TrouteRemoteTimeline,
  TrouteRemoteTimelineEntry,
  TrouteRouteProvider,
  TrouteRouteStop,
  TrouteSolverCandidate,
  TrouteSolverObjectiveScore,
  TrouteStartPolicy,
  TrouteTravelMode,
} from './types/troute.js';
