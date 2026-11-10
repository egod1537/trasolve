import { buildGlobePoints, isLand, latLonToXYZ } from 'mappo';

export type GlobePoint = { x: number; y: number; z: number };
export const globePoints = buildGlobePoints(360, [-80, 85]);
const tilt = (18 * Math.PI) / 180;

// Land, grid, routes and markers share one polar-axis rotation.
export function createGlobeProjection(angle: number) {
  const rotation = (angle * Math.PI) / 180;
  const sinR = Math.sin(rotation);
  const cosR = Math.cos(rotation);
  const sinT = Math.sin(tilt);
  const cosT = Math.cos(tilt);
  return (point: GlobePoint) => {
    const x = point.x * cosR + point.z * sinR;
    const z = -point.x * sinR + point.z * cosR;
    const y = point.y * cosT - z * sinT;
    const depth = point.y * sinT + z * cosT;
    return { x: 500 + x * 440, y: 500 - y * 440, depth };
  };
}

export const globeGrid = [
  ...[-60, -30, 0, 30, 60].map((lat) =>
    Array.from({ length: 181 }, (_, index) =>
      latLonToXYZ(lat, index * 2 - 180),
    ),
  ),
  ...Array.from({ length: 12 }, (_, index) =>
    Array.from({ length: 91 }, (_, step) =>
      latLonToXYZ(step * 2 - 90, index * 30 - 180),
    ),
  ),
];

// Geographic display data: country labels are anchored to their capitals.
export const globeCities = [
  { name: 'SEOUL', lat: 37.5665, lon: 126.978, labelX: -56, labelY: 28 },
  { name: 'JAPAN', lat: 35.6762, lon: 139.6503, labelX: 15, labelY: -6 },
  { name: 'MONGOLIA', lat: 47.9189, lon: 106.917, labelX: -82, labelY: -20 },
].map((city) => ({ ...city, point: latLonToXYZ(city.lat, city.lon) }));

function dotPath(x: number, y: number, r: number): string {
  return `M${(x - r).toFixed(1)},${y.toFixed(1)}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`;
}

// Regional illustration: real coastline dots and a Tokyo marker. The adjacent
// list shows neighborhood stops, rather than placing those across all of Japan.
export const japanDotPath = (() => {
  let path = '';
  for (let y = 0; y < 280; y += 4) {
    for (let x = 0; x < 400; x += 4) {
      const lat = 46.5 - (y / 280) * 16.5;
      const lon = 129 + (x / 400) * 18;
      if (isLand(lat, lon) && (lat < 40 || lon > 139)) {
        path += dotPath(x, y, 0.9);
      }
    }
  }
  return path;
})();

export const tokyoPosition = {
  x: ((139.6503 - 129) / 18) * 400,
  y: ((46.5 - 35.6762) / 16.5) * 280,
};
