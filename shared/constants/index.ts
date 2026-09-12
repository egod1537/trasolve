export { TravelMode } from './travelMode.js';
export { CHAT_LIMITS } from './chat.js';

export const API_ROUTES = {
  health: '/api/health',
  chat: '/api/chat',
  openWebUIModels: '/api/openwebui/models',
  trips: '/api/trips',
  routes: '/api/routes',
  placesAutocomplete: '/api/google/maps/places/autocomplete',
  places: '/api/google/maps/places',
  googleOAuthStart: '/api/auth/google/start',
  googleOAuthCallback: '/api/auth/google/callback',
  googleOAuthResult: '/api/auth/google/result',
} as const;
