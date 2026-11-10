import {
  createGlobeProjection,
  globeCities,
  globeGrid,
  globePoints,
} from './cartography';

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
  let angle = initialAngle;
  let returnAngle = initialAngle + 70 * forwardSweepRatio;
  let returning: { from: number; elapsed: number } | null = null;
  let visible = true;
  let scale = 1;
  let dotColor = '';
  let surfaceColor = '';
  let fillColor = '';
  let accentColor = '';
  let textColor = '';
  let font = '';

  const draw = () => {
    const project = createGlobeProjection(angle);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, 1000, 1000);
    const gradient = ctx.createRadialGradient(450, 400, 0, 500, 500, 560);
    gradient.addColorStop(0, fillColor);
    gradient.addColorStop(1, surfaceColor);
    ctx.globalAlpha = 1;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(500, 500, 440, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = dotColor;
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.3;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    for (const line of globeGrid) {
      let connected = false;
      for (const point of line) {
        const p = project(point);
        if (p.depth <= 0) {
          connected = false;
          continue;
        }
        if (connected) {
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.moveTo(p.x, p.y);
        }
        connected = true;
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Six depth bands preserve the approved dots' size and fading at the limb.
    const layers = Array.from({ length: 6 }, () => new Path2D());
    for (let i = 0; i < globePoints.length; i += 3) {
      const p = project({
        x: globePoints[i],
        y: globePoints[i + 1],
        z: globePoints[i + 2],
      });
      if (p.depth <= 0.025) {
        continue;
      }
      const layer = Math.min(5, Math.floor(p.depth * 6));
      const radius = 0.65 + layer * 0.13;
      layers[layer].moveTo(p.x + radius, p.y);
      layers[layer].arc(p.x, p.y, radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = dotColor;
    layers.forEach((path, index) => {
      ctx.globalAlpha = 0.25 + index * 0.13;
      ctx.fill(path);
    });

    const cities = globeCities.map((city) => ({
      ...city,
      ...project(city.point),
    }));
    const [seoul, japan, mongolia] = cities;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = accentColor;
    for (const destination of [japan, mongolia]) {
      if (seoul.depth <= 0 || destination.depth <= 0) {
        continue;
      }
      ctx.globalAlpha = Math.min(1, seoul.depth * 10, destination.depth * 10);
      ctx.beginPath();
      ctx.moveTo(seoul.x, seoul.y);
      ctx.quadraticCurveTo(
        (seoul.x + destination.x) / 2,
        Math.min(seoul.y, destination.y) - 55,
        destination.x,
        destination.y,
      );
      ctx.stroke();
    }
    ctx.font = font;
    ctx.lineJoin = 'round';
    for (const city of cities) {
      if (city.depth <= 0) {
        continue;
      }
      ctx.globalAlpha = Math.min(1, city.depth * 10);
      ctx.fillStyle = surfaceColor;
      ctx.beginPath();
      ctx.arc(city.x, city.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(city.x, city.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = surfaceColor;
      ctx.lineWidth = 4;
      ctx.strokeText(city.name, city.x + city.labelX, city.y + city.labelY);
      ctx.fillStyle = textColor;
      ctx.fillText(city.name, city.x + city.labelX, city.y + city.labelY);
    }
    ctx.globalAlpha = 1;
  };

  const refresh = () => {
    const styles = getComputedStyle(canvas);
    const color = (name: string) => styles.getPropertyValue(name).trim();
    dotColor = color('--landing-map-dot');
    surfaceColor = color('--color-surface');
    fillColor = color('--landing-globe-fill');
    accentColor = color('--color-accent');
    textColor = color('--color-text-primary');
    font = `650 ${color('--landing-globe-label-size')}px ${styles.fontFamily}`;
    const bounds = canvas.getBoundingClientRect();
    const width = bounds.width;
    const side = Math.max(
      1,
      Math.round(width * Math.min(window.devicePixelRatio || 1, 2)),
    );
    canvas.width = side;
    canvas.height = side;
    scale = side / 1000;

    // Turn back before a marker/label reaches the clipped screen edge or the
    // rear hemisphere. Cache this angle on layout changes, not every frame.
    const left = width ? Math.max(0, (-bounds.left / width) * 1000) : 0;
    const right = width
      ? Math.min(
          1000,
          ((document.documentElement.clientWidth - bounds.left) / width) * 1000,
        )
      : 1000;
    ctx.font = font;
    const initialProjection = createGlobeProjection(initialAngle);
    const markers = globeCities.map((city) => {
      const minX = Math.min(-11, city.labelX - 4);
      const maxX = Math.max(
        11,
        city.labelX + ctx.measureText(city.name).width + 4,
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
      if (returning) {
        returning.elapsed += delta;
        const progress = Math.min(1, returning.elapsed / returnDuration);
        const eased = 1 - (1 - progress) ** 3;
        angle = returning.from + (initialAngle - returning.from) * eased;
        if (progress === 1) {
          angle = initialAngle;
          returning = null;
        }
      } else if (angle >= returnAngle) {
        returning = { from: angle, elapsed: 0 };
      } else {
        angle = Math.min(returnAngle, angle + delta * 0.002);
      }
      previousTime = time;
      draw();
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
      draw();
    }
  };
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
    intersection.disconnect();
    resize.disconnect();
    theme.disconnect();
    document.removeEventListener('visibilitychange', updatePlayback);
    window.removeEventListener('resize', refresh);
    motion.removeEventListener('change', updatePlayback);
  };
}
