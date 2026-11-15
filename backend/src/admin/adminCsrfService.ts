import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { readSessionSecret } from '../auth/sessionCookie.js';

const tokenLifetimeMs = 2 * 60 * 60 * 1_000;
const allowedClockSkewMs = 60_000;

export class AdminCsrfConfigurationError extends Error {
  public constructor() {
    super('Administrator CSRF protection is not configured.');
    this.name = 'AdminCsrfConfigurationError';
  }
}

export class AdminCsrfValidationError extends Error {
  public constructor() {
    super('Administrator CSRF validation failed.');
    this.name = 'AdminCsrfValidationError';
  }
}

export class AdminCsrfService {
  public constructor(
    secret: string | undefined,
    private readonly configuredOrigin?: string,
  ) {
    this.secret = secret?.trim() ?? '';
    if (this.secret && Buffer.byteLength(this.secret, 'utf8') < 32) {
      throw new Error('TRASOLVE_ADMIN_CSRF_SECRET must be at least 32 bytes.');
    }
  }

  public issue(request: IncomingMessage): string {
    this.requireConfigured();
    const sessionSecret = readSessionSecret(request);
    if (!sessionSecret) {
      throw new AdminCsrfValidationError();
    }
    const expiresAt = Date.now() + tokenLifetimeMs;
    return `${expiresAt}.${this.sign(sessionSecret, expiresAt)}`;
  }

  public validate(
    request: IncomingMessage,
    candidate: string | undefined,
  ): void {
    this.requireConfigured();
    this.validateOrigin(request);
    const sessionSecret = readSessionSecret(request);
    const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(candidate ?? '');
    if (!sessionSecret || !match) {
      throw new AdminCsrfValidationError();
    }
    const expiresAt = Number(match[1]);
    if (
      !Number.isSafeInteger(expiresAt) ||
      expiresAt < Date.now() ||
      expiresAt > Date.now() + tokenLifetimeMs + allowedClockSkewMs
    ) {
      throw new AdminCsrfValidationError();
    }
    const expected = Buffer.from(this.sign(sessionSecret, expiresAt), 'utf8');
    const actual = Buffer.from(match[2] ?? '', 'utf8');
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw new AdminCsrfValidationError();
    }
  }

  private readonly secret: string;

  private requireConfigured(): void {
    if (!this.secret) {
      throw new AdminCsrfConfigurationError();
    }
  }

  private sign(sessionSecret: string, expiresAt: number): string {
    const binding = createHash('sha256')
      .update(sessionSecret, 'utf8')
      .digest('base64url');
    return createHmac('sha256', this.secret)
      .update(`${binding}.${expiresAt}`, 'utf8')
      .digest('base64url');
  }

  private validateOrigin(request: IncomingMessage): void {
    const expected = this.resolveExpectedOrigin(request);
    const origin = request.headers.origin;
    const referer = request.headers.referer;
    let candidate: string | undefined;
    try {
      candidate = origin
        ? new URL(origin).origin
        : referer
          ? new URL(referer).origin
          : undefined;
    } catch {
      throw new AdminCsrfValidationError();
    }
    if (!candidate || candidate !== expected) {
      throw new AdminCsrfValidationError();
    }
  }

  private resolveExpectedOrigin(request: IncomingMessage): string {
    if (this.configuredOrigin) {
      try {
        return new URL(this.configuredOrigin).origin;
      } catch {
        throw new AdminCsrfConfigurationError();
      }
    }
    const forwardedProtocol = readFirstHeader(
      request.headers['x-forwarded-proto'],
    );
    const protocol = forwardedProtocol === 'https' ? 'https' : 'http';
    const host = request.headers.host;
    if (!host) {
      throw new AdminCsrfConfigurationError();
    }
    return new URL(`${protocol}://${host}`).origin;
  }
}

function readFirstHeader(
  value: string | string[] | undefined,
): string | undefined {
  const first = Array.isArray(value) ? value[0] : value?.split(',')[0];
  return first?.trim().toLowerCase();
}
