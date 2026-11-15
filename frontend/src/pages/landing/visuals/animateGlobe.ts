import { createGlobeProjection, globeCities } from './cartography';
import { createGlobeRenderer } from './globeRenderer';
import { attachGlobeInteraction, createGlobeMotion } from './globeMotion';

const initialAngle = -130;
const forwardSweepRatio = 0.8;
const returnDuration = 850;

// Canvas avoids rebuilding thousands of SVG dot coordinates every frame.
// React owns the canvas; this effect owns drawing and all animation resources.
export function animateGlobe(
  canvas: HTMLCanvasElement,
): (() => void) | undefined {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let previousTime: number | null = null;
  let returnAngle = initialAngle + 70 * forwardSweepRatio;
  let visible = true;
  const renderer = createGlobeRenderer(canvas, ctx);
  const movement = createGlobeMotion(initialAngle);
  const draw = () => renderer.draw(movement.angle, movement.tilt);

  const refresh = () => {
    renderer.refresh();
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width;

    // Turn back before a marker/label reaches the clipped screen edge or the
    // rear hemisphere. Cache this angle on layout changes, not every frame.
    const left = width ? Math.max(0, (-bounds.left / width) * 1000) : 0;
    const right = width
      ? Math.min(
          1000,
          ((document.documentElement.clientWidth - bounds.left) / width) * 1000,
        )
      : 1000;
    const initialProjection = createGlobeProjection(initialAngle);
    const markers = globeCities.map((city) => {
      const minX = Math.min(-11, city.labelX - 4);
      const maxX = Math.max(
        11,
        city.labelX + renderer.labelWidth(city.name) + 4,
      );
      const start = initialProjection(city.point);
      return {
        ...city,
        minX,
        maxX,
        initiallyFits: start.x + minX >= left && start.x + maxX <= right,
      };
    });
    for (
      let candidate = initialAngle + 1;
      candidate <= initialAngle + 180;
      candidate++
    ) {
      const project = createGlobeProjection(candidate);
      if (
        markers.some((city) => {
          const p = project(city.point);
          return (
            p.depth <= 0.1 ||
            (city.initiallyFits &&
              (p.x + city.minX < left || p.x + city.maxX > right))
          );
        })
      ) {
        // Rewind 20% earlier within the available forward sweep.
        returnAngle =
          initialAngle + (candidate - initialAngle) * forwardSweepRatio;
        break;
      }
    }
    draw();
  };

  const tick = (time: number) => {
    frame = 0;
    if (!visible || document.hidden || motion.matches) {
      return;
    }
    if (previousTime === null) {
      previousTime = time;
    }
    const elapsed = time - previousTime;
    // Slow forward rotation, then a quick eased rewind to the starting view.
    if (elapsed >= 1000 / 30) {
      const delta = Math.min(elapsed, 100);
      if (movement.advance(delta, time, returnAngle, returnDuration)) {
        draw();
      }
      previousTime = time;
    }
    frame = requestAnimationFrame(tick);
  };
  const updatePlayback = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = null;
    if (visible && !document.hidden && !motion.matches) {
      frame = requestAnimationFrame(tick);
    } else {
      movement.pause();
      draw();
    }
  };
  const detachInteraction = attachGlobeInteraction(canvas, movement, draw);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    updatePlayback();
  });
  const resize = new ResizeObserver(refresh);
  const theme = new MutationObserver(refresh);
  refresh();
  intersection.observe(canvas);
  resize.observe(canvas);
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class', 'style'],
  });
  document.addEventListener('visibilitychange', updatePlayback);
  window.addEventListener('resize', refresh);
  motion.addEventListener('change', updatePlayback);
  updatePlayback();
  return () => {
    cancelAnimationFrame(frame);
    detachInteraction();
    intersection.disconnect();
    resize.disconnect();
    theme.disconnect();
    document.removeEventListener('visibilitychange', updatePlayback);
    window.removeEventListener('resize', refresh);
    motion.removeEventListener('change', updatePlayback);
  };
}
