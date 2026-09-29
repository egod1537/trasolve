import type { Server } from 'node:http';
import { AuthenticationService } from './auth/authenticationService.js';
import type { AuthRepository } from './auth/authRepository.js';
import { CurrentUserResolver } from './auth/currentUserResolver.js';
import { LocalAuthRepository } from './auth/localAuthRepository.js';
import { PostgresAuthRepository } from './auth/postgresAuthRepository.js';
import { PostgresSessionRepository } from './auth/postgresSessionRepository.js';
import type { SessionRepository } from './auth/sessionRepository.js';
import { SessionService } from './auth/sessionService.js';
import { loadBackendEnvironment } from './configuration/environment.js';
import {
  resolveBackendDataRoot,
  resolveBackendPersistenceMode,
} from './configuration/persistence.js';
import { Database } from './database/database.js';
import { runMigrations } from './database/migrate.js';
import { GoogleOAuthHttpFlow } from './googleOAuthHttp.js';
import { createBackendServer } from './server.js';
import { PostgresTripRepository } from './trip/repositories/postgresTripRepository.js';
import { TripController } from './trip/tripController.js';
import { TripHttpService } from './trip/tripHttpService.js';
import type { TripRepository } from './trip/tripRepository.js';
import type { TripShareRepository } from './share/tripShareRepository.js';
import { PostgresTripShareRepository } from './share/repositories/postgresTripShareRepository.js';
import { TripShareController } from './trip-sharing/tripShareController.js';
import { TripShareHttpService } from './trip-sharing/tripShareHttpService.js';
import { GoogleStaticMapsProvider } from './trip-preview/googleStaticMapsProvider.js';
import { TripPreviewHttpService } from './trip-preview/tripPreviewHttpService.js';
import type { AnalyticsRepository } from './analytics/analyticsEventRepository.js';
import { PostgresAnalyticsRepository } from './analytics/postgresAnalyticsRepository.js';
import { AnalyticsEventHttpService } from './analytics/analyticsEventHttpService.js';
import { AnalyticsQueryHttpService } from './analytics/analyticsQueryHttpService.js';

loadBackendEnvironment();

const port = Number(process.env.PORT ?? 43127);
const host = process.env.HOST ?? '127.0.0.1';

void startBackend().catch((cause: unknown) => {
  console.error('Backend startup failed.', cause);
  process.exitCode = 1;
});

async function startBackend(): Promise<void> {
  const { API, createLocalTripPersistence } = await import('./instances.js');
  const persistence = await createRuntimePersistence(
    createLocalTripPersistence,
  );
  let server: Server | undefined;

  try {
    const authentication = new AuthenticationService(persistence.auth);
    const sessions = new SessionService(persistence.sessions);
    const currentUser = new CurrentUserResolver(sessions);
    const tripController = new TripController(persistence.trips);
    server = createBackendServer(
      API,
      new GoogleOAuthHttpFlow(
        authentication,
        sessions,
        currentUser,
        persistence.localDevelopmentUserId,
      ),
      new TripHttpService(tripController, currentUser),
      new TripShareHttpService(
        new TripShareController(
          persistence.trips,
          persistence.tripShares,
          persistence.auth,
        ),
        currentUser,
      ),
      new TripPreviewHttpService(
        tripController,
        currentUser,
        new GoogleStaticMapsProvider(
          process.env.GOOGLE_STATIC_MAPS_API_KEY ?? '',
        ),
      ),
      new AnalyticsEventHttpService(persistence.analytics, currentUser),
      new AnalyticsQueryHttpService(persistence.analytics, {
        readEnabled: canUseAnalyticsReadApi(),
      }),
    );
    await listen(server, port, host);
    console.log(`Backend: http://${host}:${port}`);
  } catch (cause) {
    await persistence.close();
    throw cause;
  }

  let isShuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`Received ${signal}; shutting down.`);

    try {
      await closeServer(server);
    } finally {
      await persistence.close();
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown(signal).catch((cause: unknown) => {
        console.error('Backend shutdown failed.', cause);
        process.exitCode = 1;
      });
    });
  }
}

interface RuntimePersistence {
  readonly analytics: AnalyticsRepository;
  readonly auth: AuthRepository;
  readonly sessions: SessionRepository;
  readonly trips: TripRepository;
  readonly tripShares: TripShareRepository;
  readonly localDevelopmentUserId?: string;
  close(): Promise<void>;
}

async function createRuntimePersistence(
  createLocalTripPersistence: (rootDir: string) => {
    readonly analytics: AnalyticsRepository;
    readonly trips: TripRepository;
    readonly tripShares: TripShareRepository;
  },
): Promise<RuntimePersistence> {
  const mode = resolveBackendPersistenceMode();
  if (mode === 'local') {
    const dataRoot = resolveBackendDataRoot();
    const auth = new LocalAuthRepository({ rootDir: dataRoot });
    const tripPersistence = createLocalTripPersistence(dataRoot);
    const localDevelopmentUserId = canUseLocalDevelopmentAuthentication()
      ? await auth.ensureDevelopmentUser()
      : undefined;
    console.log(`Persistence: local (${dataRoot})`);
    if (localDevelopmentUserId) {
      console.log('Local development authentication: enabled');
    }
    return {
      auth,
      sessions: auth,
      ...tripPersistence,
      localDevelopmentUserId,
      close: () => Promise.resolve(),
    };
  }

  const database = Database.fromEnvironment();
  try {
    const migrationResult = await runMigrations(database);
    console.log(
      `Database migrations: ${migrationResult.applied.length} applied, ${migrationResult.skipped.length} already current.`,
    );
  } catch (cause) {
    await database.close();
    throw cause;
  }
  console.log('Persistence: PostgreSQL');
  return {
    analytics: new PostgresAnalyticsRepository(database),
    auth: new PostgresAuthRepository(database),
    sessions: new PostgresSessionRepository(database),
    trips: new PostgresTripRepository(database),
    tripShares: new PostgresTripShareRepository(database),
    close: () => database.close(),
  };
}

function canUseLocalDevelopmentAuthentication(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function canUseAnalyticsReadApi(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function listen(
  server: Server,
  listenPort: number,
  listenHost: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleError = (cause: Error): void => reject(cause);
    server.once('error', handleError);
    server.listen(listenPort, listenHost, () => {
      server.off('error', handleError);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((cause) => {
      if (cause) {
        reject(cause);
        return;
      }
      resolve();
    });
  });
}
