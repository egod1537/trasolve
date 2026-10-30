import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  API_ROUTES,
  type ApiErrorResponse,
  type AuthMeResponse,
  type GoogleOAuthResult,
} from '@trasolve/shared';
import type { AuthenticationService } from './auth/authenticationService.js';
import { readOpaqueCookie } from './auth/cookies.js';
import type { CurrentUserResolver } from './auth/currentUserResolver.js';
import { readSessionSecret, sessionCookieName } from './auth/sessionCookie.js';
import type { SessionService } from './auth/sessionService.js';
import { GoogleOAuthClient, GoogleOAuthError } from './googleOAuth.js';

const transactionCookieName = 'trasolve_google_oauth_transaction';
const resultCookieName = 'trasolve_google_oauth_result';
const transactionCookiePath = API_ROUTES.googleOAuthCallback;
const resultCookiePath = API_ROUTES.googleOAuthResult;
const sessionCookiePath = '/';
const defaultReturnTo = '/';
const entryLifetimeMs = 10 * 60 * 1_000;
const cookieMaxAgeSeconds = entryLifetimeMs / 1_000;
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1_000;
const sessionCookieMaxAgeSeconds = sessionLifetimeMs / 1_000;
const maximumEntries = 500;

interface OAuthTransaction {
  state: string;
  codeVerifier: string;
  returnTo: string;
}

interface StoredEntry<T> {
  expiresAt: number;
  value: T;
}

class ExpiringStore<T> {
  public create(value: T): string {
    this.removeExpired();

    while (this.entries.size >= maximumEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (typeof oldestKey !== 'string') {
        break;
      }
      this.entries.delete(oldestKey);
    }

    let id: string;
    do {
      id = randomBytes(32).toString('base64url');
    } while (this.entries.has(id));

    this.entries.set(id, {
      expiresAt: Date.now() + entryLifetimeMs,
      value,
    });

    return id;
  }

  public consume(id: string | undefined): T | undefined {
    this.removeExpired();
    if (!id) {
      return undefined;
    }

    const entry = this.entries.get(id);
    this.entries.delete(id);
    return entry?.value;
  }

  private readonly entries = new Map<string, StoredEntry<T>>();

  private removeExpired(): void {
    const now = Date.now();

    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(id);
      }
    }
  }
}

export class GoogleOAuthHttpFlow {
  public constructor(
    private readonly authentication: AuthenticationService,
    private readonly sessions: SessionService,
    private readonly currentUser: CurrentUserResolver,
    private readonly debugGuestUserId?: string,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<boolean> {
    const { pathname } = requestUrl;
    const isOAuthRoute =
      pathname === API_ROUTES.googleOAuthStart ||
      pathname === API_ROUTES.googleOAuthCallback ||
      pathname === API_ROUTES.googleOAuthResult;
    const isLocalLoginRoute = pathname === API_ROUTES.authLocalLogin;
    const isAuthMeRoute = pathname === API_ROUTES.authMe;
    const isAuthLogoutRoute = pathname === API_ROUTES.authLogout;

    if (
      !isOAuthRoute &&
      !isLocalLoginRoute &&
      !isAuthMeRoute &&
      !isAuthLogoutRoute
    ) {
      return false;
    }

    if (isLocalLoginRoute || isAuthLogoutRoute) {
      if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        const body: ApiErrorResponse = {
          error: {
            code: 'METHOD_NOT_ALLOWED',
            message: 'POST 요청을 사용해 주세요.',
          },
        };
        sendJson(response, 405, body);
        return true;
      }

      if (isLocalLoginRoute) {
        await this.handleLocalLogin(response);
      } else {
        await this.handleLogout(request, response);
      }
      return true;
    }

    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      const body: ApiErrorResponse = {
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'GET 요청을 사용해 주세요.',
        },
      };
      sendJson(response, 405, body);
      return true;
    }

    if (pathname === API_ROUTES.googleOAuthStart) {
      this.handleStart(response, requestUrl);
    } else if (pathname === API_ROUTES.googleOAuthCallback) {
      await this.handleCallback(request, response, requestUrl);
    } else if (pathname === API_ROUTES.googleOAuthResult) {
      this.handleResult(request, response);
    } else {
      await this.handleMe(request, response);
    }

    return true;
  }

  // OAuth transactions/results are short-lived, one-time handoff records, not
  // login sessions. TODO: move these to shared storage before multi-instance use.
  private readonly transactions = new ExpiringStore<OAuthTransaction>();
  private readonly results = new ExpiringStore<GoogleOAuthResult>();

  private handleStart(response: ServerResponse, requestUrl: URL): void {
    const client = createGoogleOAuthClient();
    const secure = usesSecureOAuthCookies();
    const returnTo = readSafeReturnTo(requestUrl);

    if (!client) {
      this.redirectWithResult(
        response,
        { status: 'unavailable' },
        secure,
        returnTo,
      );
      return;
    }

    const { authorizationUrl, state, codeVerifier } =
      client.createAuthorizationRequest();
    const transactionId = this.transactions.create({
      state,
      codeVerifier,
      returnTo,
    });

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Location', authorizationUrl);
    response.setHeader('Set-Cookie', [
      createCookie(
        transactionCookieName,
        transactionId,
        transactionCookiePath,
        secure,
        cookieMaxAgeSeconds,
      ),
      clearCookie(resultCookieName, resultCookiePath, secure),
    ]);
    response.writeHead(302);
    response.end();
  }

  private async handleCallback(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<void> {
    const secure = usesSecureOAuthCookies();
    const transactionId = readOpaqueCookie(request, transactionCookieName);
    const transaction = this.transactions.consume(transactionId);
    const returnTo = transaction?.returnTo ?? defaultReturnTo;
    const callbackState = requestUrl.searchParams.get('state');

    if (!transaction || !securelyMatches(callbackState, transaction.state)) {
      this.redirectWithResult(
        response,
        { status: 'error', error: 'invalid_callback' },
        secure,
        returnTo,
      );
      return;
    }

    const providerError = requestUrl.searchParams.get('error');
    if (providerError) {
      this.redirectWithResult(
        response,
        {
          status: 'error',
          error:
            providerError === 'access_denied'
              ? 'access_denied'
              : 'provider_error',
        },
        secure,
        returnTo,
      );
      return;
    }

    const authorizationCode = requestUrl.searchParams.get('code');
    if (!authorizationCode) {
      this.redirectWithResult(
        response,
        { status: 'error', error: 'invalid_callback' },
        secure,
        returnTo,
      );
      return;
    }

    const client = createGoogleOAuthClient();
    if (!client) {
      this.redirectWithResult(
        response,
        { status: 'unavailable' },
        secure,
        returnTo,
      );
      return;
    }

    try {
      const googleProfile = await client.completeAuthorization(
        authorizationCode,
        transaction.codeVerifier,
      );
      const user = await this.authentication.loginWithGoogle(googleProfile);
      const sessionSecret = await this.sessions.create(
        user.id,
        sessionLifetimeMs,
      );
      this.redirectWithResult(
        response,
        { status: 'success', user },
        secure,
        returnTo,
        [
          createCookie(
            sessionCookieName,
            sessionSecret,
            sessionCookiePath,
            secure,
            sessionCookieMaxAgeSeconds,
          ),
        ],
      );
    } catch (error) {
      this.redirectWithResult(response, mapOAuthError(error), secure, returnTo);
    }
  }

  private handleResult(
    request: IncomingMessage,
    response: ServerResponse,
  ): void {
    const secure = usesSecureOAuthCookies();
    const resultTicket = readOpaqueCookie(request, resultCookieName);
    const result = this.results.consume(resultTicket) ?? { status: 'missing' };

    response.setHeader(
      'Set-Cookie',
      clearCookie(resultCookieName, resultCookiePath, secure),
    );
    sendJson(response, 200, result);
  }

  private async handleMe(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const userId = await this.currentUser.resolve(request);
    const user = userId
      ? await this.authentication.getUserById(userId)
      : undefined;
    const body: AuthMeResponse = { user: user ?? null };
    sendJson(response, 200, body);
  }

  private async handleLocalLogin(response: ServerResponse): Promise<void> {
    if (!this.debugGuestUserId) {
      response.writeHead(404);
      response.end();
      return;
    }

    const user = await this.authentication.getUserById(this.debugGuestUserId);
    if (!user) {
      throw new Error('Debug guest user is unavailable.');
    }

    const sessionSecret = await this.sessions.create(
      user.id,
      sessionLifetimeMs,
    );
    response.setHeader(
      'Set-Cookie',
      createCookie(
        sessionCookieName,
        sessionSecret,
        sessionCookiePath,
        usesSecureOAuthCookies(),
        sessionCookieMaxAgeSeconds,
      ),
    );
    const body: AuthMeResponse = { user };
    sendJson(response, 200, body);
  }

  private async handleLogout(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const secure = usesSecureOAuthCookies();
    const sessionSecret = readSessionSecret(request);
    await this.sessions.revoke(sessionSecret);

    response.setHeader(
      'Set-Cookie',
      clearCookie(sessionCookieName, sessionCookiePath, secure),
    );
    sendJson(response, 200, { success: true });
  }

  private redirectWithResult(
    response: ServerResponse,
    result: GoogleOAuthResult,
    secure: boolean,
    returnTo: string,
    extraCookies: string[] = [],
  ): void {
    const resultTicket = this.results.create(result);
    const location = `${returnTo}${returnTo.includes('?') ? '&' : '?'}oauth=complete`;

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Location', location);
    response.setHeader('Set-Cookie', [
      clearCookie(transactionCookieName, transactionCookiePath, secure),
      createCookie(
        resultCookieName,
        resultTicket,
        resultCookiePath,
        secure,
        cookieMaxAgeSeconds,
      ),
      ...extraCookies,
    ]);
    response.writeHead(303);
    response.end();
  }
}

function createGoogleOAuthClient(): GoogleOAuthClient | undefined {
  try {
    return GoogleOAuthClient.fromEnvironment();
  } catch (error) {
    if (
      error instanceof GoogleOAuthError &&
      error.code === 'configuration_error'
    ) {
      return undefined;
    }

    throw error;
  }
}

function usesSecureOAuthCookies(): boolean {
  try {
    return (
      new URL(process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '').protocol === 'https:'
    );
  } catch {
    return false;
  }
}

function securelyMatches(candidate: string | null, expected: string): boolean {
  if (!candidate) {
    return false;
  }

  const candidateBuffer = Buffer.from(candidate, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

/**
 * Only same-origin, path-absolute returns are allowed, so an attacker cannot
 * use `returnTo` to bounce a completed login through an external site.
 */
function readSafeReturnTo(requestUrl: URL): string {
  const value = requestUrl.searchParams.get('returnTo');
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\r\n]/.test(value)
  ) {
    return defaultReturnTo;
  }

  return value;
}

function createCookie(
  name: string,
  value: string,
  path: string,
  secure: boolean,
  maxAgeSeconds: number,
): string {
  return [
    `${name}=${value}`,
    `Max-Age=${maxAgeSeconds}`,
    `Path=${path}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function clearCookie(name: string, path: string, secure: boolean): string {
  return [
    `${name}=`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    `Path=${path}`,
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

function mapOAuthError(error: unknown): GoogleOAuthResult {
  if (!(error instanceof GoogleOAuthError)) {
    return { status: 'error', error: 'provider_error' };
  }

  if (
    error.code === 'token_exchange_failed' ||
    error.code === 'invalid_token_response'
  ) {
    return { status: 'error', error: 'token_exchange_failed' };
  }

  if (
    error.code === 'userinfo_request_failed' ||
    error.code === 'invalid_userinfo_response'
  ) {
    return { status: 'error', error: 'userinfo_request_failed' };
  }

  return { status: 'error', error: 'provider_error' };
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.writeHead(statusCode);
  response.end(JSON.stringify(body));
}
