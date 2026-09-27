import type { IncomingMessage } from 'node:http';
import { readOpaqueCookie } from './cookies.js';

export const sessionCookieName = 'trasolve_session';

export function readSessionSecret(
  request: IncomingMessage,
): string | undefined {
  return readOpaqueCookie(request, sessionCookieName);
}
