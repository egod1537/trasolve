import {
  TROUTE_MAX_PREVIEW_FRAMES,
  trouteJobStateSchema,
  trouteOptimizeResponseSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';

export type OptimizationPreviewFrame = Pick<
  NonNullable<TrouteJobState['preview']>,
  'revision' | 'result'
>;
type CachedOptimization = {
  result: TrouteOptimizeResponse;
  frames: OptimizationPreviewFrame[];
};
// Older cached responses retain fewer than ten search frames.
const STORAGE_KEY = 'trasolve.route-optimization.results.v4';
const MAX_SIZE = 40;
const results = loadResults();

export function getOptimizationCacheKey(
  dayId: string,
  request: TrouteOptimizeRequest,
): string {
  return JSON.stringify({ ...request, job_id: dayId });
}

export function getCachedOptimization(key: string) {
  return results.get(key)?.result;
}

export function getCachedOptimizationFrames(key: string) {
  return results.get(key)?.frames ?? [];
}

export function retainOptimizationFrame(
  frames: readonly OptimizationPreviewFrame[],
  next: OptimizationPreviewFrame,
): OptimizationPreviewFrame[] {
  if (next.revision <= (frames.at(-1)?.revision ?? 0)) {
    return [...frames];
  }
  return frames.length < TROUTE_MAX_PREVIEW_FRAMES
    ? [...frames, next]
    : [...frames.slice(0, TROUTE_MAX_PREVIEW_FRAMES - 1), next];
}

export function cacheOptimization(
  key: string,
  result: TrouteOptimizeResponse,
  frames: readonly OptimizationPreviewFrame[] = [],
) {
  results.delete(key);
  if (results.size >= MAX_SIZE) {
    results.delete(results.keys().next().value ?? '');
  }
  results.set(key, {
    result,
    frames: frames.reduce<OptimizationPreviewFrame[]>(
      retainOptimizationFrame,
      [],
    ),
  });
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...results]));
  } catch {
    // Optimization remains available when browser storage is unavailable.
  }
}

function readEntry(value: unknown): CachedOptimization | null {
  const cached =
    typeof value === 'object' && value !== null && 'result' in value
      ? value
      : null;
  const parsed = trouteOptimizeResponseSchema.safeParse(
    cached ? cached.result : value,
  );
  if (!parsed.success) {
    return null;
  }
  const frames =
    cached && 'frames' in cached && Array.isArray(cached.frames)
      ? cached.frames
      : [];
  const latest: unknown = frames.at(-1);
  const history =
    typeof latest === 'object' && latest !== null
      ? trouteJobStateSchema.shape.preview.safeParse({ ...latest, frames })
      : null;
  return {
    result: parsed.data,
    frames: history?.success ? (history.data?.frames ?? []) : [],
  };
}

function loadResults(): Map<string, CachedOptimization> {
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
    const entries: [string, CachedOptimization][] = [];
    for (const entry of stored) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        typeof entry[0] !== 'string'
      ) {
        continue;
      }
      const parsed = readEntry(entry[1]);
      if (parsed) {
        entries.push([entry[0], parsed]);
      }
    }
    return new Map(entries.slice(-MAX_SIZE));
  } catch {
    return new Map();
  }
}
