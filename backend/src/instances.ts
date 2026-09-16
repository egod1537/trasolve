import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { tripIdSchema } from '@trasolve/shared';
import { LocalFileTripRepository } from './trip/repositories/localFileTripRepository.js';
import { TripController } from './trip/tripController.js';
import { TripHttpService } from './trip/tripHttpService.js';
import { Places } from './google/maps/places.js';
import { GoogleRoutesProvider } from './routes/providers/googleRoutesProvider.js';
import { RouteHttpService } from './routes/routeHttpService.js';
import { RouteService } from './routes/routeService.js';
import { ChatService } from './ai/chatService.js';
import { createChatProvider } from './ai/chatProviderFactory.js';
import { OpenWebUIClient, OpenWebUIClientError } from './ai/openWebUIClient.js';
import { OpenWebUIModelHttpService } from './ai/openWebUIModelHttpService.js';
import {
  ConversationContextComposer,
  InMemoryConversationContextStore,
} from './ai/conversation/conversationContext.js';
import { ConversationService } from './ai/conversation/conversationService.js';
import { InMemoryConversationSessionStore } from './ai/conversation/conversationSessionStore.js';
import { TrouteClient } from './troute/trouteClient.js';
import { TrouteClientError } from './troute/errors.js';
import { TrouteHttpService } from './troute/trouteHttpService.js';
import { TrouteJobHttpService } from './internal/troute/trouteJobHttpService.js';
import { FileTrouteJobRepository } from './internal/troute/fileTrouteJobRepository.js';

// Load configuration before constructing the shared instances, regardless of
// which backend module imports them first.
const localEnvPath = fileURLToPath(new URL('../.env.local', import.meta.url));
if (existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

// Construct shared services and providers only here. Implementation modules must
// not import this module, which would create a circular dependency.
const routeProvider = new GoogleRoutesProvider(
  process.env.GOOGLE_ROUTES_API_KEY ?? '',
);
const routes = new RouteHttpService(new RouteService(routeProvider));
const places = new Places(process.env.GOOGLE_PLACES_API_KEY ?? '');
const openWebUIApiKey = process.env.OPENWEBUI_API_KEY?.trim() ?? '';
let openWebUIClient: OpenWebUIClient | null = null;
try {
  openWebUIClient = new OpenWebUIClient({
    apiKey: openWebUIApiKey,
    baseUrl: process.env.OPENWEBUI_BASE_URL,
  });
} catch (cause) {
  if (
    !(cause instanceof OpenWebUIClientError) ||
    cause.kind !== 'configuration'
  ) {
    throw cause;
  }
}
const chatProvider = createChatProvider(
  {
    provider: process.env.AI_PROVIDER,
    openWebUIApiKey,
    openWebUIModel: process.env.OPENWEBUI_MODEL ?? '',
    geminiApiKey: process.env.GEMINI_API_KEY ?? '',
    geminiModel: process.env.GEMINI_MODEL ?? '',
  },
  openWebUIClient,
);
const chat = new ChatService(chatProvider);
const conversation = new ConversationService(
  chat,
  new InMemoryConversationSessionStore(),
  new InMemoryConversationContextStore(),
  new ConversationContextComposer(),
);
const openWebUIModels = new OpenWebUIModelHttpService(openWebUIClient);
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const dataRoot = resolve(
  repositoryRoot,
  process.env.TRASOLVE_DATA_DIR?.trim() || '.local/trasolve',
);
const tripRepository = new LocalFileTripRepository({
  rootDir: dataRoot,
});
const trip = new TripController(tripRepository);
const localUserId = tripIdSchema.parse(
  process.env.TRASOLVE_LOCAL_USER_ID?.trim() || 'local-user',
);
const tripHttp = new TripHttpService(trip, () => localUserId);
let troute: TrouteClient | null = null;
try {
  troute = new TrouteClient({
    baseUrl: process.env.TROUTE_BASE_URL ?? '',
  });
} catch (cause) {
  if (!(cause instanceof TrouteClientError) || cause.kind !== 'configuration') {
    throw cause;
  }
}
const trouteJobs = new FileTrouteJobRepository({ rootDir: dataRoot });
const trouteHttp = new TrouteHttpService(troute, trouteJobs);
const trouteJobHttp = new TrouteJobHttpService(trouteJobs, troute);

export const API = {
  Route: routes,
  Place: places,
  Chat: chat,
  Conversation: conversation,
  OpenWebUIModels: openWebUIModels,
  Trip: trip,
  TripHttp: tripHttp,
  Troute: troute,
  TrouteHttp: trouteHttp,
  TrouteJobHttp: trouteJobHttp,
};
