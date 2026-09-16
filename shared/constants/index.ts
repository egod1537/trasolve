export { TravelMode } from './travelMode.js';
export { CHAT_LIMITS } from './chat.js';

export const API_ROUTES = {
  health: '/api/health',
  chat: '/api/chat',
  openWebUIModels: '/api/openwebui/models',
  trouteOptimize: '/api/troute/optimize',
  trouteInternalHealth: '/api/internal/troute/health',
  trouteInternalJobs: '/api/internal/troute/jobs',
  trips: '/api/trips',
  routes: '/api/routes',
  placesAutocomplete: '/api/google/maps/places/autocomplete',
  places: '/api/google/maps/places',
  googleOAuthStart: '/api/auth/google/start',
  googleOAuthCallback: '/api/auth/google/callback',
  googleOAuthResult: '/api/auth/google/result',
  authMe: '/api/auth/me',
  authLogout: '/api/auth/logout',
} as const;
