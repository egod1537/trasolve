import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  API_ROUTES,
  type ApiErrorResponse,
  type GoogleOAuthResult,
} from '@trasolve/shared';
import { GoogleOAuthClient, GoogleOAuthError } from './googleOAuth.js';

const transactionCookieName = 'trasolve_google_oauth_transaction';
const resultCookieName = 'trasolve_google_oauth_result';
const transactionCookiePath = API_ROUTES.googleOAuthCallback;
const resultCookiePath = API_ROUTES.googleOAuthResult;
const frontendResultPath = '/testbed/google-oauth?oauth=complete';
const entryLifetimeMs = 10 * 60 * 1_000;
const cookieMaxAgeSeconds = entryLifetimeMs / 1_000;
const maximumEntries = 500;
const opaqueIdPattern = /^[A-Za-z0-9_-]{43}$/;

interface OAuthTransaction {
  state: string;
  codeVerifier: string;
}

interface StoredEntry<T> {
  expiresAt: number;
  value: T;
}

class ExpiringStore<T> {
  private readonly entries = new Map<string, StoredEntry<T>>();

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
  private readonly transactions = new ExpiringStore<OAuthTransaction>();
  private readonly results = new ExpiringStore<GoogleOAuthResult>();

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

    if (!isOAuthRoute) {
      return false;
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
      this.handleStart(response);
    } else if (pathname === API_ROUTES.googleOAuthCallback) {
      await this.handleCallback(request, response, requestUrl);
    } else {
      this.handleResult(request, response);
    }

    return true;
  }

  private handleStart(response: ServerResponse): void {
    const client = createGoogleOAuthClient();
    const secure = usesSecureOAuthCookies();

    if (!client) {
      this.redirectWithResult(response, { status: 'unavailable' }, secure);
      return;
    }

    const { authorizationUrl, state, codeVerifier } =
      client.createAuthorizationRequest();
    const transactionId = this.transactions.create({ state, codeVerifier });

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Location', authorizationUrl);
    response.setHeader('Set-Cookie', [
      createCookie(
        transactionCookieName,
        transactionId,
        transactionCookiePath,
        secure,
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
    const callbackState = requestUrl.searchParams.get('state');

    if (!transaction || !securelyMatches(callbackState, transaction.state)) {
      this.redirectWithResult(
        response,
        { status: 'error', error: 'invalid_callback' },
        secure,
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
      );
      return;
    }

    const authorizationCode = requestUrl.searchParams.get('code');
    if (!authorizationCode) {
      this.redirectWithResult(
        response,
        { status: 'error', error: 'invalid_callback' },
        secure,
      );
      return;
    }

    const client = createGoogleOAuthClient();
    if (!client) {
      this.redirectWithResult(response, { status: 'unavailable' }, secure);
      return;
    }

    try {
      const user = await client.completeAuthorization(
        authorizationCode,
        transaction.codeVerifier,
      );
      this.redirectWithResult(response, { status: 'success', user }, secure);
    } catch (error) {
      this.redirectWithResult(response, mapOAuthError(error), secure);
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

  private redirectWithResult(
    response: ServerResponse,
    result: GoogleOAuthResult,
    secure: boolean,
  ): void {
    const resultTicket = this.results.create(result);

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Location', frontendResultPath);
    response.setHeader('Set-Cookie', [
      clearCookie(transactionCookieName, transactionCookiePath, secure),
      createCookie(resultCookieName, resultTicket, resultCookiePath, secure),
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

function readOpaqueCookie(
  request: IncomingMessage,
  cookieName: string,
): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();

    if (name === cookieName && opaqueIdPattern.test(value)) {
      return value;
    }
  }

  return undefined;
}

function createCookie(
  name: string,
  value: string,
  path: string,
  secure: boolean,
): string {
  return [
    `${name}=${value}`,
    `Max-Age=${cookieMaxAgeSeconds}`,
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
