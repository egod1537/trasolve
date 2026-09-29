export { TravelMode } from './travelMode.js';
export { CHAT_LIMITS } from './chat.js';
export { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from './analytics.js';
export {
  GOOGLE_MAPS_DEFAULT_LANGUAGE_CODE,
  GOOGLE_MAPS_LANGUAGE_CODES,
  GOOGLE_MAPS_REGION_CODE,
  getGoogleMapsLocale,
  type GoogleMapsLanguageCode,
  type GoogleMapsLocale,
  type GoogleMapsRegionCode,
} from './googleMapsLocale.js';
export {
  TRIP_COMMAND_PLAN_FINGERPRINT_MAX_LENGTH,
  TRIP_COMMAND_PLAN_MAX_OPERATIONS,
  TRIP_COMMAND_PLAN_STEP_ID_MAX_LENGTH,
  TRIP_COMMAND_PLAN_VALIDATION_MESSAGE_MAX_LENGTH,
  TRIP_COMMAND_PLAN_VERSION,
} from './tripCommandPlan.js';

export const API_ROUTES = {
  health: '/api/health',
  analyticsEvents: '/api/analytics/events',
  analyticsFlows: '/api/analytics/flows',
  analyticsFunnels: '/api/analytics/funnels',
  analyticsOverview: '/api/analytics/overview',
  analyticsSessions: '/api/analytics/sessions',
  chat: '/api/chat',
  openWebUIModels: '/api/openwebui/models',
  trouteOptimize: '/api/troute/optimize',
  trouteInternalHealth: '/api/internal/troute/health',
  trouteInternalJobs: '/api/internal/troute/jobs',
  tcacheInternalHealth: '/api/internal/tcache/health',
  tcacheInternalJobs: '/api/internal/tcache/jobs',
  trips: '/api/trips',
  sharedTrips: '/api/shared-trips',
  routes: '/api/routes',
  placesAutocomplete: '/api/google/maps/places/autocomplete',
  places: '/api/google/maps/places',
  googleOAuthStart: '/api/auth/google/start',
  googleOAuthCallback: '/api/auth/google/callback',
  googleOAuthResult: '/api/auth/google/result',
  authLocalLogin: '/api/auth/local',
  authMe: '/api/auth/me',
  authLogout: '/api/auth/logout',
} as const;

export const API_ROUTE_SUFFIXES = {
  tripShare: '/share',
  tripPreview: '/preview',
} as const;

export function buildTripShareApiRoute(tripId: string): string {
  return `${API_ROUTES.trips}/${encodeURIComponent(tripId)}${API_ROUTE_SUFFIXES.tripShare}`;
}

/**
 * Map thumbnail of an owned Trip. `version` (e.g. updatedAt) only busts the
 * browser cache; the server always renders the stored Trip.
 */
export function buildTripPreviewApiRoute(
  tripId: string,
  version?: string,
): string {
  const route = `${API_ROUTES.trips}/${encodeURIComponent(tripId)}${API_ROUTE_SUFFIXES.tripPreview}`;
  return version ? `${route}?v=${encodeURIComponent(version)}` : route;
}

export function buildSharedTripApiRoute(token: string): string {
  return `${API_ROUTES.sharedTrips}/${encodeURIComponent(token)}`;
}

export function buildAnalyticsSessionEventsRoute(sessionId: string): string {
  return `${API_ROUTES.analyticsSessions}/${encodeURIComponent(sessionId)}/events`;
}

export function buildAnalyticsFunnelApiRoute(funnelId: string): string {
  return `${API_ROUTES.analyticsFunnels}/${encodeURIComponent(funnelId)}`;
}
