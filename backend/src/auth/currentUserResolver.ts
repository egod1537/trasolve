import type { IncomingMessage } from 'node:http';
import { readSessionSecret } from './sessionCookie.js';
import type { SessionService } from './sessionService.js';

export class AuthenticationRequiredError extends Error {
  public constructor() {
    super('Authentication is required.');
    this.name = 'AuthenticationRequiredError';
  }
}

export class CurrentUserResolver {
  public constructor(private readonly sessions: SessionService) {}

  public resolve(request: IncomingMessage): Promise<string | undefined> {
    return this.sessions.resolveUserId(readSessionSecret(request));
  }

  public async require(request: IncomingMessage): Promise<string> {
    const userId = await this.resolve(request);
    if (!userId) {
      throw new AuthenticationRequiredError();
    }
    return userId;
  }
}
