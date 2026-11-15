export type ScrollAxis = 'vertical' | 'horizontal';

export type WheelScrollTarget = {
  element: HTMLElement;
  axis: ScrollAxis;
  delta: number;
};

const NATIVE_CONTROLS =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-lenis-prevent], [data-lenis-prevent-wheel]';
const SCROLLABLE_OVERFLOW = /^(auto|scroll|overlay)$/;

export function isDocumentScrollLocked(axis: ScrollAxis): boolean {
  return [document.body, document.documentElement].some((element) => {
    const style = getComputedStyle(element);
    const overflow = axis === 'vertical' ? style.overflowY : style.overflowX;
    return overflow === 'hidden' || overflow === 'clip';
  });
}

export function findWheelScrollTarget(
  event: WheelEvent,
): WheelScrollTarget | null {
  const horizontal =
    event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
  const axis: ScrollAxis = horizontal ? 'horizontal' : 'vertical';
  const rawDelta = horizontal ? event.deltaX || event.deltaY : event.deltaY;
  if (!Number.isFinite(rawDelta) || rawDelta === 0) {
    return null;
  }
  const path = event
    .composedPath()
    .filter((node): node is HTMLElement => node instanceof HTMLElement);
  if (
    path.some((element) =>
      element.matches(`${NATIVE_CONTROLS}, [data-lenis-prevent-${axis}]`),
    )
  ) {
    return null;
  }

  for (const element of path) {
    // App cards inside a gesture surface can still own their own scroll.
    if (element.hasAttribute('data-scroll-gesture-surface')) {
      return null;
    }
    if (element === document.body || element === document.documentElement) {
      continue;
    }
    const style = getComputedStyle(element);
    const overflow = horizontal ? style.overflowX : style.overflowY;
    if (!SCROLLABLE_OVERFLOW.test(overflow)) {
      continue;
    }
    const size = horizontal ? element.clientWidth : element.clientHeight;
    const extent = horizontal ? element.scrollWidth : element.scrollHeight;
    if (size === 0 || extent <= size) {
      continue;
    }
    const position = horizontal ? element.scrollLeft : element.scrollTop;
    const boundary = horizontal
      ? style.overscrollBehaviorX
      : style.overscrollBehaviorY;
    const canScroll =
      rawDelta < 0 ? position > 0 : position < extent - size - 1;
    if (canScroll || boundary === 'contain' || boundary === 'none') {
      return { element, axis, delta: normalizeDelta(event, rawDelta, size) };
    }
  }

  if (isDocumentScrollLocked(axis)) {
    return null;
  }
  const element = document.documentElement;
  const size = horizontal ? element.clientWidth : element.clientHeight;
  const extent = horizontal ? element.scrollWidth : element.scrollHeight;
  return extent > size
    ? { element, axis, delta: normalizeDelta(event, rawDelta, size) }
    : null;
}

function normalizeDelta(
  event: WheelEvent,
  delta: number,
  pageSize: number,
): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return delta * 16;
  }
  return event.deltaMode === WheelEvent.DOM_DELTA_PAGE
    ? delta * pageSize
    : delta;
}
