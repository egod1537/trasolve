import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { tripIdSchema } from '@trasolve/shared';
import { LocalFileTripRepository } from './trip/repositories/localFileTripRepository.js';
import { TripController } from './trip/tripController.js';
import { TripHttpService } from './trip/tripHttpService.js';
import { Routes } from './google/maps/routes.js';
import { Places } from './google/maps/places.js';
import { ChatService } from './ai/chatService.js';
import { RandomChatProvider } from './ai/providers/randomChatProvider.js';

// Load configuration before constructing the shared instances, regardless of
// which backend module imports them first.
const localEnvPath = fileURLToPath(new URL('../.env.local', import.meta.url));
if (existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

// Construct shared services and providers only here. Implementation modules must
// not import this module, which would create a circular dependency.
const routes = new Routes(process.env.GOOGLE_ROUTES_API_KEY ?? '');
const places = new Places(process.env.GOOGLE_PLACES_API_KEY ?? '');
const chatProvider = new RandomChatProvider();
const chat = new ChatService(chatProvider);
const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const tripRepository = new LocalFileTripRepository({
  rootDir: resolve(
    backendRoot,
    process.env.TRASOLVE_DATA_DIR?.trim() || 'data',
  ),
});
const trip = new TripController(tripRepository);
const localUserId = tripIdSchema.parse(
  process.env.TRASOLVE_LOCAL_USER_ID?.trim() || 'local-user',
);
const tripHttp = new TripHttpService(trip, () => localUserId);

export const API = {
  Route: routes,
  Place: places,
  Chat: chat,
  Trip: trip,
  TripHttp: tripHttp,
};
