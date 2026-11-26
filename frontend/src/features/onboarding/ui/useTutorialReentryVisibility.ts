import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

const collisionCheckIntervalMs = 500;
const sampleInset = 2;
const floatingTags = new Set(['ASIDE', 'DIALOG']);
const floatingRoles = new Set([
  'alert',
  'alertdialog',
  'dialog',
  'listbox',
  'menu',
  'tooltip',
]);

export function useTutorialReentryVisibility(
  actionsRef: RefObject<HTMLElement | null>,
): boolean {
  const [obscured, setObscured] = useState(false);
  const obscuredRef = useRef(false);

  useLayoutEffect(() => {
    const actions = actionsRef.current;
    if (!actions) {
      return;
    }

    let frame: number | null = null;
    const check = () => {
      frame = null;
      const nextObscured = isObscured(actions);
      if (nextObscured === obscuredRef.current) {
        return;
      }
      obscuredRef.current = nextObscured;
      setObscured(nextObscured);
    };
    const schedule = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(check);
      }
    };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(actions);
    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => !actions.contains(record.target))) {
        schedule();
      }
    });
    mutationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'open', 'style'],
      childList: true,
      subtree: true,
    });
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    const interval = window.setInterval(schedule, collisionCheckIntervalMs);
    schedule();

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.clearInterval(interval);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
    };
  }, [actionsRef]);

  return obscured;
}

function isObscured(actions: HTMLElement): boolean {
  if (!actions.isConnected) {
    return false;
  }
  const previousVisibility = actions.style.visibility;
  const previousOpacity = actions.style.opacity;
  const previousPointerEvents = actions.style.pointerEvents;
  const previousInert = actions.inert;
  actions.style.visibility = 'visible';
  actions.style.opacity = '0';
  actions.style.pointerEvents = 'auto';
  actions.inert = false;
  const rect = actions.getBoundingClientRect();
  const result =
    rect.width > 0 &&
    rect.height > 0 &&
    samplePoints(rect).some(({ x, y }) => pointHasCollision(actions, x, y));
  actions.style.visibility = previousVisibility;
  actions.style.opacity = previousOpacity;
  actions.style.pointerEvents = previousPointerEvents;
  actions.inert = previousInert;
  return result;
}

function samplePoints(rect: DOMRect): Array<{ x: number; y: number }> {
  const xs = [
    rect.left + sampleInset,
    rect.left + rect.width / 2,
    rect.right - sampleInset,
  ];
  const ys = [
    rect.top + sampleInset,
    rect.top + rect.height / 2,
    rect.bottom - sampleInset,
  ];
  return xs.flatMap((x) => ys.map((y) => ({ x, y })));
}

function pointHasCollision(
  actions: HTMLElement,
  x: number,
  y: number,
): boolean {
  const stack = document.elementsFromPoint(x, y);
  const ownIndex = stack.findIndex(
    (element) => element === actions || actions.contains(element),
  );
  if (ownIndex < 0) {
    return true;
  }
  if (stack.slice(0, ownIndex).some((element) => !element.contains(actions))) {
    return true;
  }
  return stack
    .slice(ownIndex + 1)
    .some((element) => isFloatingLayout(element, actions, x, y));
}

function isFloatingLayout(
  element: Element,
  actions: HTMLElement,
  x: number,
  y: number,
): boolean {
  if (element.contains(actions) || element.closest('.trip-map-marker')) {
    return false;
  }
  for (
    let current: Element | null = element;
    current && current !== document.body;
    current = current.parentElement
  ) {
    if (current.contains(actions)) {
      return false;
    }
    const rect = current.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      continue;
    }
    if (floatingTags.has(current.tagName)) {
      return true;
    }
    const role = current.getAttribute('role');
    if (role && floatingRoles.has(role)) {
      return true;
    }
    const coversViewport =
      rect.width >= window.innerWidth * 0.85 &&
      rect.height >= window.innerHeight * 0.85;
    if (coversViewport) {
      continue;
    }
    const style = window.getComputedStyle(current);
    const zIndex = Number.parseInt(style.zIndex, 10);
    if (
      style.position === 'fixed' ||
      style.position === 'sticky' ||
      (style.position === 'absolute' &&
        Number.isFinite(zIndex) &&
        zIndex >= 100)
    ) {
      return true;
    }
  }
  return false;
}
