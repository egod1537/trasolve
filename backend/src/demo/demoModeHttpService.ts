import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  demoEnterResponseSchema,
  demoStatusSchema,
  initialTutorialProgress,
  type DemoStatus,
} from '@trasolve/shared';
import type { AuthenticationService } from '../auth/authenticationService.js';
import type { AuthRepository } from '../auth/authRepository.js';
import { readOpaqueCookie } from '../auth/cookies.js';
import type { CurrentUserResolver } from '../auth/currentUserResolver.js';
import {
  clearCookie,
  createCookie,
  sessionLifetimeMs,
  usesSecureOAuthCookies,
} from '../auth/httpCookies.js';
import { sessionCookieName, readSessionSecret } from '../auth/sessionCookie.js';
import type { SessionService } from '../auth/sessionService.js';
import {
  isDemoModeAutomatic,
  isDemoQueryEnabled,
} from '../configuration/demoMode.js';
import type { TripController } from '../trip/tripController.js';
import type { TripRepository } from '../trip/tripRepository.js';
import { createDemoExampleTrip } from './demoExampleTrip.js';

const workspaceCookieName = 'trasolve_demo_workspace';
const cookiePath = '/';
const workspaceLifetimeSeconds = 365 * 24 * 60 * 60;
const sessionLifetimeSeconds = sessionLifetimeMs / 1000;

export class DemoModeHttpService {
  public constructor(
    private readonly authentication: AuthenticationService,
    private readonly auth: AuthRepository,
    private readonly sessions: SessionService,
    private readonly currentUser: CurrentUserResolver,
    private readonly trips: TripRepository,
    private readonly tripController: TripController,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    try {
      if (request.method === 'GET') {
        this.send(response, 200, await this.status(request));
        return;
      }
      if (request.method === 'DELETE') {
        await this.sessions.revoke(readSessionSecret(request));
        response.setHeader(
          'Set-Cookie',
          clearCookie(sessionCookieName, cookiePath, usesSecureOAuthCookies()),
        );
        this.send(response, 200, { success: true });
        return;
      }
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'GET, POST, DELETE');
        this.send(response, 405, { error: { code: 'METHOD_NOT_ALLOWED' } });
        return;
      }
      if (
        request.headers['x-trasolve-demo'] !== '1' ||
        request.headers['sec-fetch-site'] === 'cross-site'
      ) {
        this.send(response, 403, { error: { code: 'FORBIDDEN' } });
        return;
      }
      const input = await this.readInput(request);
      if (
        !isDemoModeAutomatic() &&
        !(isDemoQueryEnabled() && input.requested)
      ) {
        this.send(response, 404, { error: { code: 'DEMO_MODE_DISABLED' } });
        return;
      }
      const activeUserId = await this.currentUser.resolve(request);
      if (
        activeUserId &&
        !(await this.authentication.isDemoUser(activeUserId)) &&
        !(await this.authentication.isDebugGuestUser(activeUserId))
      ) {
        this.send(response, 409, { error: { code: 'ACCOUNT_ALREADY_ACTIVE' } });
        return;
      }
      const workspaceToken =
        readOpaqueCookie(request, workspaceCookieName) ??
        randomBytes(32).toString('base64url');
      const user = await this.authentication.ensureDemoGuest(
        this.subject(workspaceToken),
      );
      await this.prepareWorkspace(user.id, input.reset);
      const secret = await this.sessions.create(user.id, sessionLifetimeMs);
      const status = await this.statusForUser(user.id, true);
      response.setHeader('Set-Cookie', [
        createCookie(
          workspaceCookieName,
          workspaceToken,
          cookiePath,
          usesSecureOAuthCookies(),
          workspaceLifetimeSeconds,
        ),
        createCookie(
          sessionCookieName,
          secret,
          cookiePath,
          usesSecureOAuthCookies(),
          sessionLifetimeSeconds,
        ),
      ]);
      this.send(response, 200, demoEnterResponseSchema.parse({ user, status }));
    } catch {
      this.send(response, 503, { error: { code: 'DEMO_MODE_UNAVAILABLE' } });
    }
  }

  private readonly operations = new Map<string, Promise<void>>();

  private async status(request: IncomingMessage): Promise<DemoStatus> {
    const activeUserId = await this.currentUser.resolve(request);
    if (activeUserId && (await this.authentication.isDemoUser(activeUserId))) {
      return this.statusForUser(activeUserId, true);
    }
    const token = readOpaqueCookie(request, workspaceCookieName);
    const identity = token
      ? await this.auth.findIdentity('urn:trasolve:demo', this.subject(token))
      : undefined;
    return identity
      ? this.statusForUser(identity.userId, false)
      : demoStatusSchema.parse({
          available: isDemoModeAutomatic() || isDemoQueryEnabled(),
          automatic: isDemoModeAutomatic(),
          active: false,
          hasPreviousActivity: false,
          exampleTripId: null,
        });
  }

  private async statusForUser(
    userId: string,
    active: boolean,
  ): Promise<DemoStatus> {
    const workspace = await this.auth.getDemoWorkspace(userId);
    const trips = await this.trips.list(userId);
    const example = workspace?.exampleTripId
      ? trips.find(({ trip }) => trip.id === workspace.exampleTripId)?.trip
      : undefined;
    const tutorial = await this.auth.getTutorialProgress(userId);
    const hasPreviousActivity = Boolean(
      workspace?.initialized &&
      (workspace.activity ||
        !example ||
        trips.length !== 1 ||
        example.updatedAt !== workspace.exampleUpdatedAt ||
        tutorial.status !== 'not-started'),
    );
    return demoStatusSchema.parse({
      available: isDemoModeAutomatic() || isDemoQueryEnabled(),
      automatic: isDemoModeAutomatic(),
      active,
      hasPreviousActivity,
      exampleTripId: workspace?.exampleTripId ?? null,
    });
  }

  private prepareWorkspace(userId: string, reset: boolean): Promise<void> {
    const previous = this.operations.get(userId) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const workspace = await this.auth.getDemoWorkspace(userId);
        if (reset) {
          await this.trips.deleteAll(userId);
          await this.auth.saveTutorialProgress(
            userId,
            initialTutorialProgress(),
          );
        } else if (workspace?.initialized) {
          return;
        }
        const input = createDemoExampleTrip();
        const existing = reset
          ? undefined
          : (await this.trips.list(userId)).find(
              ({ trip }) => trip.title === input.title,
            );
        const example =
          existing ?? (await this.tripController.createTrip(userId, input));
        await this.auth.saveDemoWorkspace(userId, {
          initialized: true,
          exampleTripId: example.trip.id,
          exampleUpdatedAt: example.trip.updatedAt,
          activity: false,
        });
      });
    this.operations.set(userId, current);
    return current.finally(() => {
      if (this.operations.get(userId) === current) {
        this.operations.delete(userId);
      }
    });
  }

  private subject(workspaceToken: string): string {
    return createHash('sha256').update(workspaceToken).digest('hex');
  }

  private async readInput(
    request: IncomingMessage,
  ): Promise<{ requested: boolean; reset: boolean }> {
    if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
      throw new Error('Demo request must be JSON.');
    }
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.length;
      if (length > 1024) {
        throw new Error('Demo request is too large.');
      }
      chunks.push(buffer);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
      string,
      unknown
    >;
    return { requested: value.requested === true, reset: value.reset === true };
  }

  private send(response: ServerResponse, status: number, body: unknown): void {
    if (response.destroyed || response.writableEnded) {
      return;
    }
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify(body));
  }
}
