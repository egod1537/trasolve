import { createHash, randomBytes } from 'node:crypto';
import type { GoogleOAuthUser } from '@trasolve/shared';

const authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const userInfoEndpoint = 'https://openidconnect.googleapis.com/v1/userinfo';
const oauthScopes = ['openid', 'email', 'profile'] as const;
const localHostnames = ['localhost', '127.0.0.1', '[::1]'];
const upstreamTimeoutMs = 10_000;

interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleTokenResponse {
  accessToken: string;
}

export interface GoogleOAuthAuthorizationRequest {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
}

export type GoogleOAuthErrorCode =
  | 'configuration_error'
  | 'invalid_authorization_input'
  | 'token_exchange_failed'
  | 'invalid_token_response'
  | 'userinfo_request_failed'
  | 'invalid_userinfo_response';

export class GoogleOAuthError extends Error {
  public constructor(
    public readonly code: GoogleOAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

export class GoogleOAuthClient {
  private constructor(private readonly config: GoogleOAuthConfig) {}

  public static fromEnvironment(
    environment: NodeJS.ProcessEnv = process.env,
  ): GoogleOAuthClient {
    const clientId = readRequiredEnvironmentVariable(
      environment,
      'GOOGLE_OAUTH_CLIENT_ID',
    );
    const clientSecret = readRequiredEnvironmentVariable(
      environment,
      'GOOGLE_OAUTH_CLIENT_SECRET',
    );
    const redirectUri = readRedirectUri(environment);

    return new GoogleOAuthClient({ clientId, clientSecret, redirectUri });
  }

  public createAuthorizationRequest(): GoogleOAuthAuthorizationRequest {
    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier, 'ascii')
      .digest('base64url');
    const authorizationUrl = new URL(authorizationEndpoint);

    authorizationUrl.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: oauthScopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    }).toString();

    return {
      authorizationUrl: authorizationUrl.toString(),
      state,
      codeVerifier,
    };
  }

  public async completeAuthorization(
    authorizationCode: string,
    codeVerifier: string,
  ): Promise<GoogleOAuthUser> {
    const code = requireAuthorizationValue(
      authorizationCode,
      'authorization code',
    );
    const verifier = requireAuthorizationValue(codeVerifier, 'PKCE verifier');
    const { accessToken } = await this.exchangeAuthorizationCode(
      code,
      verifier,
    );

    return this.fetchUserInfo(accessToken);
  }

  private async exchangeAuthorizationCode(
    authorizationCode: string,
    codeVerifier: string,
  ): Promise<GoogleTokenResponse> {
    let response: Response;

    try {
      response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code: authorizationCode,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
        }),
        signal: AbortSignal.timeout(upstreamTimeoutMs),
      });
    } catch {
      throw new GoogleOAuthError(
        'token_exchange_failed',
        'Google token exchange request failed',
      );
    }

    if (!response.ok) {
      throw new GoogleOAuthError(
        'token_exchange_failed',
        'Google token exchange was rejected',
      );
    }

    const body = await readJsonObject(response, 'invalid_token_response');
    const accessToken = body.access_token;

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new GoogleOAuthError(
        'invalid_token_response',
        'Google token response did not include an access token',
      );
    }

    return { accessToken };
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleOAuthUser> {
    let response: Response;

    try {
      response = await fetch(userInfoEndpoint, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(upstreamTimeoutMs),
      });
    } catch {
      throw new GoogleOAuthError(
        'userinfo_request_failed',
        'Google UserInfo request failed',
      );
    }

    if (!response.ok) {
      throw new GoogleOAuthError(
        'userinfo_request_failed',
        'Google UserInfo request was rejected',
      );
    }

    const body = await readJsonObject(response, 'invalid_userinfo_response');
    const id = readRequiredString(body, 'sub');
    const email = readRequiredString(body, 'email');
    const emailVerified = body.email_verified;

    if (typeof emailVerified !== 'boolean') {
      throw new GoogleOAuthError(
        'invalid_userinfo_response',
        'Google UserInfo response is missing required fields',
      );
    }

    const user: GoogleOAuthUser = { id, email, emailVerified };
    const name = readOptionalString(body, 'name');
    const pictureUrl = readOptionalHttpsUrl(body, 'picture');

    if (name) {
      user.name = name;
    }
    if (pictureUrl) {
      user.pictureUrl = pictureUrl;
    }

    return user;
  }
}

function readRequiredEnvironmentVariable(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new GoogleOAuthError(
      'configuration_error',
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

function readRedirectUri(environment: NodeJS.ProcessEnv): string {
  const value = readRequiredEnvironmentVariable(
    environment,
    'GOOGLE_OAUTH_REDIRECT_URI',
  );
  let redirectUri: URL;

  try {
    redirectUri = new URL(value);
  } catch {
    throw new GoogleOAuthError(
      'configuration_error',
      'GOOGLE_OAUTH_REDIRECT_URI must be an absolute URL',
    );
  }

  const isLocalHttp =
    redirectUri.protocol === 'http:' &&
    localHostnames.includes(redirectUri.hostname);

  if (
    (redirectUri.protocol !== 'https:' && !isLocalHttp) ||
    redirectUri.username ||
    redirectUri.password ||
    redirectUri.hash
  ) {
    throw new GoogleOAuthError(
      'configuration_error',
      'GOOGLE_OAUTH_REDIRECT_URI must use HTTPS or local HTTP and must not include credentials or a fragment',
    );
  }

  return value;
}

function requireAuthorizationValue(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new GoogleOAuthError(
      'invalid_authorization_input',
      `Missing ${label}`,
    );
  }

  return normalizedValue;
}

async function readJsonObject(
  response: Response,
  errorCode: 'invalid_token_response' | 'invalid_userinfo_response',
): Promise<Record<string, unknown>> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new GoogleOAuthError(errorCode, 'Google returned invalid JSON');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new GoogleOAuthError(
      errorCode,
      'Google returned an invalid response',
    );
  }

  return body as Record<string, unknown>;
}

function readRequiredString(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = body[field];

  if (typeof value !== 'string' || !value.trim()) {
    throw new GoogleOAuthError(
      'invalid_userinfo_response',
      'Google UserInfo response is missing required fields',
    );
  }

  return value.trim();
}

function readOptionalString(
  body: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = body[field];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readOptionalHttpsUrl(
  body: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = readOptionalString(body, field);
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
