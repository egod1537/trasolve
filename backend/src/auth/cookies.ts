import type { IncomingMessage } from 'node:http';

const opaqueCookieValuePattern = /^[A-Za-z0-9_-]{43}$/;

export function readOpaqueCookie(
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
    if (name === cookieName && opaqueCookieValuePattern.test(value)) {
      return value;
    }
  }

  return undefined;
}
