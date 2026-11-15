import { useLayoutEffect, useState, type CSSProperties } from 'react';

const gap = 10;
const edge = 12;

// A body portal avoids clipping by the main result card's bounded scroll area.
export function useRouteDetailPlacement(trigger: HTMLElement): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    const card = trigger.closest<HTMLElement>('.route-settings-panel');
    if (!card) {
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = card.getBoundingClientRect();
      const width = Math.min(360, Math.max(0, window.innerWidth - edge * 2));
      const height = Math.min(
        rect.height,
        Math.max(0, window.innerHeight - edge * 2),
      );
      const right = rect.right + gap;
      const left = rect.left - width - gap;
      const x =
        right + width <= window.innerWidth - edge
          ? right
          : left >= edge
            ? left
            : rect.right - width;
      const next = {
        visibility: 'visible' as const,
        left: Math.max(edge, Math.min(x, window.innerWidth - edge - width)),
        top: Math.max(
          edge,
          Math.min(rect.top, window.innerHeight - edge - height),
        ),
        width,
        height,
      };
      setStyle((current) =>
        Object.entries(next).every(
          ([key, value]) => current[key as keyof CSSProperties] === value,
        )
          ? current
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(card);
    const position = new MutationObserver(schedule);
    const roots = new Set([
      card,
      card.closest('.anchored-map-card'),
      card.closest('.route-settings-card'),
    ]);
    for (const root of roots) {
      if (root) {
        position.observe(root, {
          attributes: true,
          attributeFilter: ['style'],
        });
      }
    }
    update();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, {
      capture: true,
      passive: true,
    });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      position.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [trigger]);
  return style;
}
