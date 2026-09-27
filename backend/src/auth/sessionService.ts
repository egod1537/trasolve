import { createHash, randomBytes } from 'node:crypto';
import type { SessionRepository } from './sessionRepository.js';

const sessionSecretPattern = /^[A-Za-z0-9_-]{43}$/;

export class SessionService {
  public constructor(private readonly repository: SessionRepository) {}

  public async create(userId: string, lifetimeMs: number): Promise<string> {
    if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs <= 0) {
      throw new Error('Session lifetime must be a positive integer.');
    }

    const secret = randomBytes(32).toString('base64url');
    await this.repository.create({
      tokenHash: hashSessionSecret(secret),
      userId,
      expiresAt: new Date(Date.now() + lifetimeMs),
    });
    return secret;
  }

  public async resolveUserId(
    secret: string | undefined,
  ): Promise<string | undefined> {
    if (!secret || !sessionSecretPattern.test(secret)) {
      return undefined;
    }
    const session = await this.repository.findValidByTokenHash(
      hashSessionSecret(secret),
    );
    return session?.userId;
  }

  public async revoke(secret: string | undefined): Promise<void> {
    if (!secret || !sessionSecretPattern.test(secret)) {
      return;
    }
    await this.repository.revokeByTokenHash(hashSessionSecret(secret));
  }
}

function hashSessionSecret(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}
