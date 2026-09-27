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

loadBackendEnvironment();

const port = Number(process.env.PORT ?? 43127);
const host = process.env.HOST ?? '127.0.0.1';

void startBackend().catch((cause: unknown) => {
  console.error('Backend startup failed.', cause);
  process.exitCode = 1;
});

async function startBackend(): Promise<void> {
  const { API, createLocalTripRepository } = await import('./instances.js');
  const persistence = await createRuntimePersistence(createLocalTripRepository);
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
  readonly auth: AuthRepository;
  readonly sessions: SessionRepository;
  readonly trips: TripRepository;
  readonly localDevelopmentUserId?: string;
  close(): Promise<void>;
}

async function createRuntimePersistence(
  createLocalTripRepository: (rootDir: string) => TripRepository,
): Promise<RuntimePersistence> {
  const mode = resolveBackendPersistenceMode();
  if (mode === 'local') {
    const dataRoot = resolveBackendDataRoot();
    const auth = new LocalAuthRepository({ rootDir: dataRoot });
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
      trips: createLocalTripRepository(dataRoot),
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
    auth: new PostgresAuthRepository(database),
    sessions: new PostgresSessionRepository(database),
    trips: new PostgresTripRepository(database),
    close: () => database.close(),
  };
}

function hasGoogleOAuthConfiguration(): boolean {
  return [
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI,
  ].every((value) => Boolean(value?.trim()));
}

function canUseLocalDevelopmentAuthentication(): boolean {
  return (
    process.env.NODE_ENV !== 'production' && !hasGoogleOAuthConfiguration()
  );
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
