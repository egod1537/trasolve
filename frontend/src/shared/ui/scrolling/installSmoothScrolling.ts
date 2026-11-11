import Lenis from 'lenis';
import {
  findWheelScrollTarget,
  isDocumentScrollLocked,
  type WheelScrollTarget,
} from './wheelScrollTarget';

type ActiveScroll = WheelScrollTarget & { lenis: Lenis };

/** One lazily created Lenis engine serves pages, nested panels and portals. */
export function installSmoothScrolling(): () => void {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active: ActiveScroll | null = null;
  let frame = 0;

  const clear = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    active?.lenis.destroy();
    active = null;
  };
  const animate = (time: number): void => {
    frame = 0;
    if (!active) {
      return;
    }
    if (
      !active.element.isConnected ||
      active.element.clientHeight === 0 ||
      (active.element === document.documentElement &&
        isDocumentScrollLocked(active.axis))
    ) {
      clear();
      return;
    }
    active.lenis.raf(time);
    if (active.lenis.isScrolling === 'smooth') {
      frame = requestAnimationFrame(animate);
    }
  };
  const onWheel = (event: WheelEvent): void => {
    if (
      event.defaultPrevented ||
      !event.cancelable ||
      event.ctrlKey ||
      event.metaKey ||
      reducedMotion.matches
    ) {
      clear();
      return;
    }
    const target = findWheelScrollTarget(event);
    if (!target) {
      clear();
      return;
    }
    if (active?.element !== target.element || active.axis !== target.axis) {
      clear();
      active = {
        ...target,
        lenis: createEngine(target),
      };
    }
    event.preventDefault();
    if (!frame) {
      // Reset the engine clock after idle time before starting a new gesture.
      active.lenis.raf(performance.now());
    }
    active.lenis.scrollTo(active.lenis.targetScroll + target.delta, {
      programmatic: false,
      lerp: 0.16,
    });
    if (!frame) {
      frame = requestAnimationFrame(animate);
    }
  };

  const removeListeners = listenForScrollInput(onWheel, clear, reducedMotion);
  const observer = new MutationObserver(() => {
    if (active && !active.element.isConnected) {
      clear();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    clear();
    observer.disconnect();
    removeListeners();
  };
}

function createEngine(target: WheelScrollTarget): Lenis {
  return new Lenis({
    wrapper:
      target.element === document.documentElement ? window : target.element,
    content: target.element,
    orientation: target.axis,
    // Capture routing also reaches portals whose map host stops bubbling.
    // Lenis owns interpolation; this listener owns wheel targeting only.
    virtualScroll: () => false,
    syncTouch: false,
    naiveDimensions: true,
    lerp: 0.16,
  });
}

function listenForScrollInput(
  onWheel: (event: WheelEvent) => void,
  clear: () => void,
  reducedMotion: MediaQueryList,
): () => void {
  // Native touch, keyboard navigation and scrollbar dragging interrupt inertia.
  window.addEventListener('wheel', onWheel, { capture: true, passive: false });
  window.addEventListener('pointerdown', clear, {
    capture: true,
    passive: true,
  });
  window.addEventListener('touchstart', clear, {
    capture: true,
    passive: true,
  });
  window.addEventListener('keydown', clear, true);
  window.addEventListener('blur', clear);
  reducedMotion.addEventListener('change', clear);
  return () => {
    reducedMotion.removeEventListener('change', clear);
    window.removeEventListener('wheel', onWheel, true);
    window.removeEventListener('pointerdown', clear, true);
    window.removeEventListener('touchstart', clear, true);
    window.removeEventListener('keydown', clear, true);
    window.removeEventListener('blur', clear);
  };
}
