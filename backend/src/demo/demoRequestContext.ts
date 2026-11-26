import type { IncomingMessage } from 'node:http';

export function hasDemoRequestContext(request: IncomingMessage): boolean {
  const referrer = request.headers.referer;
  const host = request.headers.host;
  if (!referrer || !host) {
    return false;
  }
  try {
    const url = new URL(referrer);
    const value = url.searchParams.get('demo');
    return (
      url.host.toLowerCase() === host.toLowerCase() &&
      (value === '1' || value === 'true')
    );
  } catch {
    return false;
  }
}
