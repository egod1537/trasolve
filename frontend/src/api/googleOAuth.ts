import {
  API_ROUTES,
  googleOAuthResultSchema,
  type GoogleOAuthResult,
} from '@trasolve/shared';

let resultRequest: Promise<GoogleOAuthResult> | undefined;

export function startGoogleOAuth(): void {
  window.location.assign(API_ROUTES.googleOAuthStart);
}

export function consumeGoogleOAuthResult(): Promise<GoogleOAuthResult> {
  resultRequest ??= requestGoogleOAuthResult();
  return resultRequest;
}

async function requestGoogleOAuthResult(): Promise<GoogleOAuthResult> {
  const response = await fetch(API_ROUTES.googleOAuthResult, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Google OAuth result request failed');
  }

  return googleOAuthResultSchema.parse(await response.json());
}
