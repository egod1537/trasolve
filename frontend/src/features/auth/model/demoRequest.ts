const DEMO_QUERY_KEY = 'demo';

export function isDemoModeRequested(search = window.location.search): boolean {
  return readDemoRequest(search) !== null;
}

export function withDemoRequest(
  path: string,
  search = window.location.search,
): string {
  const request = readDemoRequest(search);
  if (request === null) {
    return path;
  }
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) {
    return path;
  }
  url.searchParams.set(DEMO_QUERY_KEY, request);
  return url.pathname + url.search + url.hash;
}

function readDemoRequest(search: string): '1' | 'true' | null {
  const value = new URLSearchParams(search).get(DEMO_QUERY_KEY);
  return value === '1' || value === 'true' ? value : null;
}
