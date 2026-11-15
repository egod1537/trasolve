/** Width used to select responsive rules when ?mobile=1 is present. */
export const MOBILE_LAYOUT_PREVIEW_WIDTH = 390;

export function isMobileLayoutForced(search = window.location.search): boolean {
  return new URLSearchParams(search).get('mobile') === '1';
}

export function matchesLayoutMaxWidth(width: number): boolean {
  return isMobileLayoutForced()
    ? MOBILE_LAYOUT_PREVIEW_WIDTH <= width
    : window.matchMedia(`(max-width: ${width}px)`).matches;
}

export function withMobileLayout(path: string): string {
  if (!isMobileLayoutForced()) {
    return path;
  }
  const url = new URL(path, window.location.origin);
  if (url.origin !== window.location.origin) {
    return path;
  }
  url.searchParams.set('mobile', '1');
  return url.pathname + url.search + url.hash;
}
