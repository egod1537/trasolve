import { loadBackendEnvironment } from './configuration/environment.js';
import { loadExternalApiPolicy } from './configuration/externalApiPolicy.js';
import { resolveBackendDataRoot } from './configuration/persistence.js';
import { Places } from './google/maps/places.js';
import { TcacheRoutesProvider } from './routes/providers/tcacheRoutesProvider.js';
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
import { JobEventSubscriptionManager } from './internal/troute/jobEventSubscriptionManager.js';
import { TcacheClient } from './internal/tcache/tcacheClient.js';
import { TcacheClientError } from './internal/tcache/types.js';
import { TcacheJobHttpService } from './internal/tcache/tcacheJobHttpService.js';
import { LocalFileTripRepository } from './trip/repositories/localFileTripRepository.js';
import type { TripRepository } from './trip/tripRepository.js';
import type { TripShareRepository } from './share/tripShareRepository.js';
import { LocalFileTripShareRepository } from './trip-sharing/localFileTripShareRepository.js';
import { LocalNdjsonAnalyticsEventRepository } from './analytics/localNdjsonAnalyticsEventRepository.js';
import type { AnalyticsRepository } from './analytics/analyticsEventRepository.js';

// Preserve direct module use while the normal bootstrap loads configuration
// before running database migrations and importing these instances.
loadBackendEnvironment();
const externalApiPolicy = loadExternalApiPolicy();

// Construct shared services and providers only here. Implementation modules must
// not import this module, which would create a circular dependency.
const places = new Places(
  process.env.GOOGLE_PLACES_API_KEY ?? '',
  15000,
  externalApiPolicy,
);
const openWebUIApiKey = process.env.OPENWEBUI_API_KEY?.trim() ?? '';
let openWebUIClient: OpenWebUIClient | null = null;
try {
  openWebUIClient = new OpenWebUIClient({
    apiKey: openWebUIApiKey,
    baseUrl: process.env.OPENWEBUI_BASE_URL,
    cloudflareAccessClientId: process.env.CLOUDFLARE_ACCESS_CLIENT_ID,
    cloudflareAccessClientSecret: process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
    externalApiPolicy,
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
    geminiNativeTools: process.env.GEMINI_NATIVE_TOOLS === '1',
    geminiBaseUrl: process.env.GEMINI_API_BASE_URL?.trim() || undefined,
  },
  openWebUIClient,
  externalApiPolicy,
);
const chat = new ChatService(chatProvider);
const conversation = new ConversationService(
  chat,
  new InMemoryConversationSessionStore(),
  new InMemoryConversationContextStore(),
  new ConversationContextComposer(),
);
const openWebUIModels = new OpenWebUIModelHttpService(openWebUIClient);
const dataRoot = resolveBackendDataRoot();
let troute: TrouteClient | null = null;
try {
  troute = new TrouteClient({
    baseUrl: process.env.TROUTE_BASE_URL ?? '',
    externalApiPolicy,
  });
} catch (cause) {
  if (!(cause instanceof TrouteClientError) || cause.kind !== 'configuration') {
    throw cause;
  }
}
const trouteJobs = new FileTrouteJobRepository({ rootDir: dataRoot });
const trouteSubscriptions = troute
  ? new JobEventSubscriptionManager(trouteJobs, troute)
  : null;
const trouteHttp = new TrouteHttpService(
  troute,
  trouteJobs,
  trouteSubscriptions,
  process.env.TROUTE_PARTIAL_VISIT_ENABLED === 'true',
  externalApiPolicy,
);
const trouteJobHttp = new TrouteJobHttpService(
  trouteJobs,
  troute,
  trouteSubscriptions,
  externalApiPolicy,
);
let tcache: TcacheClient | null = null;
try {
  tcache = new TcacheClient({
    baseUrl: process.env.TCACHE_BASE_URL ?? '',
    externalApiPolicy,
  });
} catch (cause) {
  if (!(cause instanceof TcacheClientError) || cause.kind !== 'configuration') {
    throw cause;
  }
}
const tcacheJobHttp = new TcacheJobHttpService(tcache);
const routeProvider = new TcacheRoutesProvider(tcache);
const routes = new RouteHttpService(new RouteService(routeProvider));

export interface LocalTripPersistence {
  readonly analytics: AnalyticsRepository;
  readonly trips: TripRepository;
  readonly tripShares: TripShareRepository;
}

export function createLocalTripPersistence(
  rootDir: string,
): LocalTripPersistence {
  return {
    analytics: new LocalNdjsonAnalyticsEventRepository({ rootDir }),
    trips: new LocalFileTripRepository({ rootDir }),
    tripShares: new LocalFileTripShareRepository({ rootDir }),
  };
}

export const API = {
  Route: routes,
  Place: places,
  Chat: chat,
  Conversation: conversation,
  OpenWebUIModels: openWebUIModels,
  Troute: troute,
  TrouteHttp: trouteHttp,
  TrouteJobHttp: trouteJobHttp,
  TrouteJobs: trouteJobs,
  Tcache: tcache,
  TcacheJobHttp: tcacheJobHttp,
};
