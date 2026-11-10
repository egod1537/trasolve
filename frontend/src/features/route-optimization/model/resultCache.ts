import {
  trouteOptimizeResponseSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';

const STORAGE_KEY = 'trasolve.route-optimization.results.v1';
const MAX_SIZE = 40;
const results = loadResults();

export function getOptimizationCacheKey(
  dayId: string,
  request: TrouteOptimizeRequest,
): string {
  return JSON.stringify({ ...request, job_id: dayId });
}

export function getCachedOptimization(key: string) {
  return results.get(key);
}

export function cacheOptimization(key: string, result: TrouteOptimizeResponse) {
  results.delete(key);
  if (results.size >= MAX_SIZE) {
    results.delete(results.keys().next().value ?? '');
  }
  results.set(key, result);
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...results]));
  } catch {
    // Optimization remains available when browser storage is unavailable.
  }
}

function loadResults(): Map<string, TrouteOptimizeResponse> {
  if (typeof window === 'undefined') {
    return new Map();
  }
  try {
    const stored: unknown = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? '[]',
    );
    if (!Array.isArray(stored)) {
      return new Map();
    }
    const entries: [string, TrouteOptimizeResponse][] = [];
    for (const entry of stored) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== 'string'
      ) {
        continue;
      }
      const parsed = trouteOptimizeResponseSchema.safeParse(entry[1]);
      if (parsed.success) {
        entries.push([entry[0], parsed.data]);
      }
    }
    return new Map(entries.slice(-MAX_SIZE));
  } catch {
    return new Map();
  }
}
