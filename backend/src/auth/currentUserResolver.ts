import type { IncomingMessage } from 'node:http';
import { readSessionSecret } from './sessionCookie.js';
import type { SessionService } from './sessionService.js';
import type { AuthenticationService } from './authenticationService.js';

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
      resolved = this.resolveSession(request).then(async (userId) =>
        userId && !(await this.authentication.requiresConsent(userId))
          ? userId
          : undefined,
      );
      this.users.set(request, resolved);
    }
    return resolved;
  }

  public resolveSession(request: IncomingMessage): Promise<string | undefined> {
    let resolved = this.sessionUsers.get(request);
    if (!resolved) {
      resolved = this.sessions.resolveUserId(readSessionSecret(request));
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

  private readonly users = new WeakMap<
    IncomingMessage,
    Promise<string | undefined>
  >();
  private readonly sessionUsers = new WeakMap<
    IncomingMessage,
    Promise<string | undefined>
  >();
}
