// Narrow declarations for the public geometry exports used from mappo 0.3.0.
declare module 'mappo' {
  export function buildGlobePoints(
    cols: number,
    latRange: [number, number],
  ): Float32Array;
  export function latLonToXYZ(
    lat: number,
    lon: number,
  ): { x: number; y: number; z: number };
  export function isLand(lat: number, lon: number): boolean;
}
