import {
  createGlobeProjection,
  globeCities,
  globeGrid,
  globePoints,
} from './cartography';

export function createGlobeRenderer(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
) {
  let scale = 1;
  let dotColor = '';
  let surfaceColor = '';
  let fillColor = '';
  let accentColor = '';
  let textColor = '';
  let font = '';

  const draw = (angle: number, tilt: number) => {
    const project = createGlobeProjection(angle, tilt);
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
  };
  const labelWidth = (label: string) => {
    ctx.font = font;
    return ctx.measureText(label).width;
  };
  return { draw, refresh, labelWidth };
}
