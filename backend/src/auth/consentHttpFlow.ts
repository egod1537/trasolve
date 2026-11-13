import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  API_ROUTES,
  LEGAL_PATHS,
  LEGAL_VERSIONS,
  authConsentAcceptanceSchema,
  type AuthConsentAcceptance,
  type AuthConsentStatus,
} from '@trasolve/shared';
import {
  canonicalGoogleIssuer,
  createConsentReceipt,
  type AuthenticationService,
  type PendingIdentity,
} from './authenticationService.js';
import type { CurrentUserResolver } from './currentUserResolver.js';
import type { SessionService } from './sessionService.js';
import { readOpaqueCookie } from './cookies.js';
import { readSessionSecret, sessionCookieName } from './sessionCookie.js';
import { ExpiringStore } from './expiringStore.js';
import {
  clearCookie,
  createCookie,
  sessionLifetimeMs,
  usesSecureOAuthCookies,
} from './httpCookies.js';
import { safeReturnTo } from './safeReturnTo.js';

const pendingCookie = 'trasolve_pending_signup';
const acceptanceRequest = authConsentAcceptanceSchema.extend({
  returnTo: z.string().max(4096).optional(),
});

export class ConsentHttpFlow {
  public constructor(
    private readonly authentication: AuthenticationService,
    private readonly sessions: SessionService,
    private readonly currentUser: CurrentUserResolver,
  ) {}

  public redirectPending(
    response: ServerResponse,
    identity: PendingIdentity,
    returnTo: string,
    cookies: string[],
  ): void {
    const ticket = this.pending.create({
      identity,
      returnTo: safeReturnTo(returnTo),
    });
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Set-Cookie', [
      ...cookies,
      createCookie(
        pendingCookie,
        ticket,
        API_ROUTES.authConsent,
        usesSecureOAuthCookies(),
        600,
      ),
    ]);
    const mobile =
      new URL(returnTo, 'https://trasolve.invalid').searchParams.get(
        'mobile',
      ) === '1';
    response.writeHead(303, {
      Location: LEGAL_PATHS.consent + (mobile ? '?mobile=1' : ''),
    });
    response.end();
  }

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Vary', 'Cookie');
    response.setHeader('X-Request-ID', randomUUID());
    try {
      if (request.method === 'GET' && url.pathname === API_ROUTES.authConsent) {
        this.send(response, 200, await this.status(request, response, url));
        return;
      }
      if (request.method !== 'POST') {
        response.setHeader(
          'Allow',
          url.pathname === API_ROUTES.authConsent ? 'GET, POST' : 'POST',
        );
        this.send(response, 405, { error: { code: 'METHOD_NOT_ALLOWED' } });
        return;
      }
      if (!isSameOriginJson(request)) {
        this.failures.set(response, 'origin');
        this.send(response, 403, { error: { code: 'INVALID_ORIGIN' } });
        return;
      }
      if (url.pathname === API_ROUTES.authConsentCancel) {
        await this.cancel(request, response);
        return;
      }
      const { returnTo, ...acceptance } = acceptanceRequest.parse(
        await readJson(request),
      );
      if (
        acceptance.termsVersion !== LEGAL_VERSIONS.terms ||
        acceptance.privacyVersion !== LEGAL_VERSIONS.privacy
      ) {
        this.send(response, 409, { error: { code: 'LEGAL_VERSION_CHANGED' } });
        return;
      }
      await this.accept(request, response, acceptance, returnTo);
    } catch (cause) {
      const invalid =
        cause instanceof z.ZodError ||
        cause instanceof SyntaxError ||
        cause instanceof RangeError;
      const code =
        cause && typeof cause === 'object' && 'code' in cause
          ? cause.code
          : null;
      if (typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code)) {
        this.failures.set(response, code);
      }
      this.send(response, invalid ? 400 : 503, {
        error: { code: invalid ? 'INVALID_CONSENT' : 'CONSENT_UNAVAILABLE' },
      });
    }
  }

  public clearPendingCookie(): string {
    return clearCookie(
      pendingCookie,
      API_ROUTES.authConsent,
      usesSecureOAuthCookies(),
    );
  }

  private readonly pending = new ExpiringStore<{
    identity: PendingIdentity;
    returnTo: string;
    acceptance?: AuthConsentAcceptance;
  }>();
  private readonly accepting = new Set<string>();
  private readonly failures = new WeakMap<ServerResponse, string>();

  private async accept(
    request: IncomingMessage,
    response: ServerResponse,
    acceptance: AuthConsentAcceptance,
    returnTo: string | undefined,
  ): Promise<void> {
    const pendingTicket = readOpaqueCookie(request, pendingCookie);
    const lockKey = pendingTicket ?? readSessionSecret(request);
    if (lockKey && this.accepting.has(lockKey)) {
      this.send(response, 429, { error: { code: 'CONSENT_IN_PROGRESS' } });
      return;
    }
    if (lockKey) {
      this.accepting.add(lockKey);
    }
    let unissuedSecret: string | undefined;
    try {
      // Keep the original ticket and expiry until all persistence succeeds.
      const staged = this.pending.get(pendingTicket);
      const sessionUserId = await this.currentUser.resolveSession(request);
      if (
        (pendingTicket && !staged) ||
        (!staged && !sessionUserId) ||
        (staged?.identity.linkUserId &&
          staged.identity.linkUserId !== sessionUserId)
      ) {
        response.setHeader('Set-Cookie', this.clearPendingCookie());
        this.send(response, 401, {
          error: { code: 'CONSENT_SESSION_EXPIRED' },
        });
        return;
      }
      if (
        staged?.acceptance &&
        JSON.stringify(staged.acceptance) !== JSON.stringify(acceptance)
      ) {
        this.send(response, 409, { error: { code: 'CONSENT_RETRY_CHANGED' } });
        return;
      }
      if (staged) {
        staged.acceptance ??= acceptance;
      }
      const user = staged
        ? await this.authentication.completeConsent(staged.identity, acceptance)
        : await this.authentication.acceptForUser(
            sessionUserId!,
            createConsentReceipt(acceptance),
          );
      const secret = await this.sessions.create(user.id, sessionLifetimeMs);
      unissuedSecret = secret;
      if (staged && this.pending.get(pendingTicket) !== staged) {
        response.setHeader('Set-Cookie', this.clearPendingCookie());
        this.send(response, 401, {
          error: { code: 'CONSENT_SESSION_EXPIRED' },
        });
        return;
      }
      // Rotate even a pre-existing session when admitting it through the consent gate.
      await this.sessions.revoke(readSessionSecret(request));
      // Another tab may have cancelled, or the handoff may have expired, during I/O.
      if (staged && this.pending.get(pendingTicket) !== staged) {
        response.setHeader('Set-Cookie', this.clearPendingCookie());
        this.send(response, 401, {
          error: { code: 'CONSENT_SESSION_EXPIRED' },
        });
        return;
      }
      if (response.destroyed) {
        return;
      }
      this.pending.consume(pendingTicket);
      response.setHeader('Set-Cookie', [
        createCookie(
          sessionCookieName,
          secret,
          '/',
          usesSecureOAuthCookies(),
          sessionLifetimeMs / 1000,
        ),
        this.clearPendingCookie(),
      ]);
      this.send(response, 200, {
        user,
        returnTo: staged?.returnTo ?? safeReturnTo(returnTo),
      });
      unissuedSecret = undefined;
    } finally {
      if (unissuedSecret) {
        await this.sessions.revoke(unissuedSecret).catch(() => {});
      }
      if (lockKey) {
        this.accepting.delete(lockKey);
      }
    }
  }

  private async status(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<AuthConsentStatus> {
    const pendingTicket = readOpaqueCookie(request, pendingCookie);
    let staged = this.pending.get(pendingTicket);
    const userId = await this.currentUser.resolveSession(request);
    if (
      pendingTicket &&
      (!staged ||
        (staged.identity.linkUserId && staged.identity.linkUserId !== userId))
    ) {
      response.setHeader('Set-Cookie', this.clearPendingCookie());
      staged = undefined;
    }
    const user = userId
      ? await this.authentication.getUserById(userId)
      : undefined;
    const acceptance = user
      ? await this.authentication.getConsent(user.id)
      : undefined;
    const required =
      staged || (user && (await this.authentication.requiresConsent(user.id)));
    return {
      status: required ? 'required' : user ? 'accepted' : 'signed-out',
      provider: staged
        ? staged.identity.issuer === canonicalGoogleIssuer
          ? 'google'
          : 'ssu'
        : (user?.loginProvider ?? null),
      versions: LEGAL_VERSIONS,
      acceptance: staged ? null : (acceptance ?? null),
      returnTo:
        staged?.returnTo ?? safeReturnTo(url.searchParams.get('returnTo')),
      operatorName: process.env.TRASOLVE_LEGAL_OPERATOR_NAME?.trim() || null,
      contactEmail:
        z.email().safeParse(process.env.TRASOLVE_PRIVACY_CONTACT_EMAIL?.trim())
          .data ?? null,
      contactUrl: 'https://github.com/egod1537/trasolve/issues',
    };
  }

  private async cancel(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    this.pending.consume(readOpaqueCookie(request, pendingCookie));
    const cookies = [this.clearPendingCookie()];
    // Error responses must clear the handoff too, including storage failures.
    response.setHeader('Set-Cookie', cookies);
    const userId = await this.currentUser.resolveSession(request);
    if (userId && (await this.authentication.requiresConsent(userId))) {
      cookies.push(
        clearCookie(sessionCookieName, '/', usesSecureOAuthCookies()),
      );
      response.setHeader('Set-Cookie', cookies);
      await this.sessions.revoke(readSessionSecret(request));
    }
    response.setHeader('Set-Cookie', cookies);
    this.send(response, 200, { success: true });
  }

  private send(response: ServerResponse, status: number, body: unknown): void {
    if (status >= 400) {
      const error = body as { error?: { code?: string } };
      console.warn(
        JSON.stringify({
          event: 'auth_consent_failure',
          requestId: response.getHeader('X-Request-ID'),
          status,
          code: error.error?.code,
          detail: this.failures.get(response),
        }),
      );
    }
    if (!response.destroyed && !response.headersSent) {
      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify(body));
    }
  }
}

function isSameOriginJson(request: IncomingMessage): boolean {
  try {
    const protocol =
      request.headers['x-forwarded-proto'] === 'https' ||
      'encrypted' in request.socket
        ? 'https:'
        : 'http:';
    const origin = new URL(request.headers.origin ?? '');
    return (
      origin.protocol === protocol &&
      origin.host === request.headers.host &&
      request.headers['sec-fetch-site'] !== 'cross-site' &&
      /^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')
    );
  } catch {
    return false;
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 4096) {
      throw new RangeError('Consent request is too large.');
    }
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
