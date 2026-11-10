import type { Server } from 'node:http';
import { BillingService } from './billing/billingService.js';
import { createPaymentProviders } from './billing/paymentProviderFactory.js';
import {
  BillingHttpService,
  TokenMeter,
} from './billing/billingHttpService.js';
import { LocalBillingRepository } from './billing/localBillingRepository.js';
import { PostgresBillingRepository } from './billing/postgresBillingRepository.js';
import type { BillingRepository } from './billing/billingRepository.js';
import { AuthenticationService } from './auth/authenticationService.js';
import type { AuthRepository } from './auth/authRepository.js';
import { CurrentUserResolver } from './auth/currentUserResolver.js';
import { LocalAuthRepository } from './auth/localAuthRepository.js';
import { PostgresAuthRepository } from './auth/postgresAuthRepository.js';
import { PostgresSessionRepository } from './auth/postgresSessionRepository.js';
import type { SessionRepository } from './auth/sessionRepository.js';
import { SessionService } from './auth/sessionService.js';
import { loadBackendEnvironment } from './configuration/environment.js';
import { loadExternalApiPolicy } from './configuration/externalApiPolicy.js';
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
import type { AnalyticsRepository } from './analytics/analyticsEventRepository.js';
import { PostgresAnalyticsRepository } from './analytics/postgresAnalyticsRepository.js';
import { AnalyticsEventHttpService } from './analytics/analyticsEventHttpService.js';
import { AnalyticsQueryHttpService } from './analytics/analyticsQueryHttpService.js';
import type {
  AdminAuthorizationRecord,
  AdminRepository,
} from './admin/adminRepository.js';
import { PostgresAdminRepository } from './admin/postgresAdminRepository.js';
import { AdminAuthorizationService } from './admin/adminAuthorizationService.js';
import { AdminCsrfService } from './admin/adminCsrfService.js';
import { AdminHttpService } from './admin/adminHttpService.js';
import {
  configureExternalApiUsageRecorder,
  ExternalApiUsageRecorder,
} from './observability/externalApiUsage/externalApiUsage.js';
import { PostgresExternalApiUsageWriter } from './observability/externalApiUsage/postgresExternalApiUsageWriter.js';

const developmentAdminCsrfSecret =
  'trasolve-local-development-admin-csrf-secret';

loadBackendEnvironment();
const externalApiPolicy = loadExternalApiPolicy();

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
  let renewalTimer: ReturnType<typeof setInterval> | undefined;

  try {
    const authentication = new AuthenticationService(persistence.auth);
    const sessions = new SessionService(persistence.sessions);
    const currentUser = new CurrentUserResolver(sessions);
    const paymentProviders = createPaymentProviders();
    const billing = new BillingService(
      persistence.billing,
      paymentProviders.normal,
      paymentProviders.debug,
    );
    const tokenMeter = new TokenMeter(billing, currentUser);
    API.Chat.setTokenMeter(tokenMeter);
    API.TrouteHttp.setTokenMeter(tokenMeter);
    renewalTimer = setInterval(() => {
      void billing
        .renewDue()
        .catch(() => console.error('Subscription renewal scan failed.'));
    }, 60_000);
    renewalTimer.unref();
    configureExternalApiUsageRecorder(persistence.externalApiUsage);
    const debugGuestUser = isDebugGuestAuthenticationEnabled()
      ? await authentication.ensureDebugGuest(resolveDebugGuestSubject())
      : undefined;
    const developmentAdmin = createDevelopmentAdmin(
      persistence.admin,
      debugGuestUser,
    );
    const adminAuthorization = new AdminAuthorizationService(
      currentUser,
      persistence.admin,
      developmentAdmin,
    );
    const adminHttp = new AdminHttpService(
      adminAuthorization,
      persistence.admin,
      new AdminCsrfService(
        developmentAdmin
          ? (process.env.TRASOLVE_ADMIN_CSRF_SECRET ??
              developmentAdminCsrfSecret)
          : persistence.admin
            ? process.env.TRASOLVE_ADMIN_CSRF_SECRET
            : undefined,
        persistence.admin || developmentAdmin
          ? process.env.TRASOLVE_PUBLIC_ORIGIN
          : undefined,
      ),
      API.TrouteJobs,
    );
    const tripController = new TripController(persistence.trips);
    server = createBackendServer(
      API,
      new GoogleOAuthHttpFlow(
        authentication,
        sessions,
        currentUser,
        debugGuestUser?.id,
        externalApiPolicy,
      ),
      new TripHttpService(tripController, currentUser),
      new TripShareHttpService(
        new TripShareController(
          persistence.trips,
          persistence.tripShares,
          persistence.auth,
          tripController,
        ),
        currentUser,
      ),
      new AnalyticsEventHttpService(persistence.analytics, currentUser),
      new AnalyticsQueryHttpService(persistence.analytics, {
        readEnabled: canUseAnalyticsReadApi(),
      }),
      currentUser,
      adminHttp,
      new BillingHttpService(billing, currentUser),
    );
    await listen(server, port, host);
    console.log(`Backend: http://${host}:${port}`);
  } catch (cause) {
    if (renewalTimer) {
      clearInterval(renewalTimer);
    }
    await persistence.close();
    throw cause;
  }

  let isShuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    if (renewalTimer) {
      clearInterval(renewalTimer);
    }
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

function createDevelopmentAdmin(
  repository: AdminRepository | null,
  debugGuestUser:
    | {
        id: string;
        name?: string;
        email: string | null;
        emailVerified: boolean;
      }
    | undefined,
): AdminAuthorizationRecord | undefined {
  if (repository || process.env.NODE_ENV === 'production' || !debugGuestUser) {
    return undefined;
  }
  return {
    id: debugGuestUser.id,
    displayName:
      debugGuestUser.name ?? debugGuestUser.email ?? debugGuestUser.id,
    email: debugGuestUser.email,
    role: 'admin',
    deleted: false,
    suspended: false,
    hasVerifiedGoogleIdentity: debugGuestUser.emailVerified,
  };
}

interface RuntimePersistence {
  readonly billing: BillingRepository;
  readonly admin: AdminRepository | null;
  readonly analytics: AnalyticsRepository;
  readonly auth: AuthRepository;
  readonly externalApiUsage: ExternalApiUsageRecorder | null;
  readonly sessions: SessionRepository;
  readonly trips: TripRepository;
  readonly tripShares: TripShareRepository;
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
    console.log(`Persistence: local (${dataRoot})`);
    return {
      billing: new LocalBillingRepository(dataRoot),
      admin: null,
      auth,
      externalApiUsage: null,
      sessions: auth,
      ...tripPersistence,
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
  const admin = new PostgresAdminRepository(database);
  const externalApiUsage = new ExternalApiUsageRecorder(
    new PostgresExternalApiUsageWriter(database),
  );
  return {
    billing: new PostgresBillingRepository(database),
    admin,
    analytics: new PostgresAnalyticsRepository(database),
    auth: new PostgresAuthRepository(database),
    sessions: new PostgresSessionRepository(database),
    externalApiUsage,
    trips: new PostgresTripRepository(database),
    tripShares: new PostgresTripShareRepository(database),
    close: async () => {
      await externalApiUsage.flush();
      configureExternalApiUsageRecorder(null);
      await database.close();
    },
  };
}

function isDebugGuestAuthenticationEnabled(): boolean {
  const configured = process.env.TRASOLVE_DEBUG_GUEST_AUTH?.trim();
  if (!configured) {
    return process.env.NODE_ENV !== 'production';
  }
  if (configured === 'true') {
    return true;
  }
  if (configured === 'false') {
    return false;
  }
  throw new Error('TRASOLVE_DEBUG_GUEST_AUTH must be true or false.');
}

function resolveDebugGuestSubject(): string {
  const subject = process.env.TRASOLVE_DEBUG_GUEST_SUBJECT?.trim() || 'default';
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(subject)) {
    throw new Error(
      'TRASOLVE_DEBUG_GUEST_SUBJECT must use lowercase letters, digits, and hyphens.',
    );
  }
  return subject;
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
