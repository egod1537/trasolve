import { useEffect } from 'react';

/** Keep fixed mobile panels above the on-screen keyboard without storing state. */
export function VisualViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Pinch zoom should magnify the page, not rearrange the interface.
      if (viewport && viewport.scale !== 1) {
        return;
      }
      root.style.setProperty(
        '--app-viewport-height',
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.style.setProperty(
        '--app-viewport-top',
        `${viewport?.offsetTop ?? 0}px`,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      root.style.removeProperty('--app-viewport-height');
      root.style.removeProperty('--app-viewport-top');
    };
  }, []);
  return null;
}
