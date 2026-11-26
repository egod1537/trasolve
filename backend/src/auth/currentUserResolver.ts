import type { IncomingMessage } from 'node:http';
import { hasDemoRequestContext } from '../demo/demoRequestContext.js';
import { readSessionSecret } from './sessionCookie.js';
import type { SessionService } from './sessionService.js';
import type {
  AuthenticationService,
  SessionAuthorization,
} from './authenticationService.js';

export class AuthenticationRequiredError extends Error {
  public constructor() {
    super('Authentication is required.');
    this.name = 'AuthenticationRequiredError';
  }
}

export class CurrentUserResolver {
  public constructor(
    private readonly sessions: SessionService,
    private readonly authentication: AuthenticationService,
  ) {}

  public resolve(request: IncomingMessage): Promise<string | undefined> {
    let resolved = this.users.get(request);
    if (!resolved) {
      resolved = this.resolveSession(request).then(async (userId) => {
        if (!userId) {
          return undefined;
        }
        const authorization = await this.resolveAuthorization(request, userId);
        if (!authorization || authorization.requiresConsent) {
          return undefined;
        }
        return userId;
      });
      this.users.set(request, resolved);
    }
    return resolved;
  }

  public resolveSession(request: IncomingMessage): Promise<string | undefined> {
    let resolved = this.sessionUsers.get(request);
    if (!resolved) {
      resolved = this.sessions
        .resolveUserId(readSessionSecret(request))
        .then(async (userId) => {
          if (!userId) {
            return undefined;
          }
          const authorization = await this.resolveAuthorization(
            request,
            userId,
          );
          if (!authorization) {
            return undefined;
          }
          if (authorization.demo && !hasDemoRequestContext(request)) {
            return undefined;
          }
          return userId;
        });
      this.sessionUsers.set(request, resolved);
    }
    return resolved;
  }

  public async require(request: IncomingMessage): Promise<string> {
    const userId = await this.resolve(request);
    if (!userId) {
      throw new AuthenticationRequiredError();
    }
    return userId;
  }

  public async isDemo(request: IncomingMessage): Promise<boolean> {
    const userId = await this.resolve(request);
    return userId ? this.authentication.isDemoUser(userId) : false;
  }

  public async markDemoActivity(request: IncomingMessage): Promise<void> {
    const userId = await this.resolve(request);
    if (userId) {
      await this.authentication.markDemoActivity(userId);
    }
  }

  private resolveAuthorization(
    request: IncomingMessage,
    userId: string,
  ): Promise<SessionAuthorization | undefined> {
    let resolved = this.authorizations.get(request);
    if (!resolved) {
      resolved = this.authentication.getSessionAuthorization(userId);
      this.authorizations.set(request, resolved);
    }
    return resolved;
  }

  private readonly authorizations = new WeakMap<
    IncomingMessage,
    Promise<SessionAuthorization | undefined>
  >();
  private readonly users = new WeakMap<
    IncomingMessage,
    Promise<string | undefined>
  >();
  private readonly sessionUsers = new WeakMap<
    IncomingMessage,
    Promise<string | undefined>
  >();
}
