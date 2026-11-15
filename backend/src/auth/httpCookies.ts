import { ssuCallbackUrl } from '../ssuSso.js';

export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export function usesSecureOAuthCookies(): boolean {
  try {
    return (
      process.env.NODE_ENV === 'production' ||
      ssuCallbackUrl()?.protocol === 'https:' ||
      new URL(process.env.GOOGLE_OAUTH_REDIRECT_URI ?? '').protocol === 'https:'
    );
  } catch {
    return false;
  }
}

export function createCookie(
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

export function clearCookie(
  name: string,
  path: string,
  secure: boolean,
): string {
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
