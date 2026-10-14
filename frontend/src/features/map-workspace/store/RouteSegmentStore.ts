import type { DirectionsRequest, DirectionsResult } from '@trasolve/shared';
import type {
  RouteSegmentQuery,
  RouteSegmentState,
} from '@/features/map-workspace/domain/routeSegment';
import { toRouteSegmentCandidates } from '@/features/map-workspace/model/routeViewModel';

export type QueryDirections = (
  request: DirectionsRequest,
  signal: AbortSignal,
) => Promise<DirectionsResult>;

export type RouteSegmentSnapshot = {
  states: ReadonlyMap<string, RouteSegmentState>;
  /** Chosen candidate index per query key; absent means the first one. */
  selections: ReadonlyMap<string, number>;
};

const MAX_CONCURRENT_REQUESTS = 3;
const LOADING_STATE: RouteSegmentState = Object.freeze({ status: 'loading' });

/** API client errors carry a backend error code (e.g. ROUTE_NOT_FOUND). */
function hasErrorCode(error: unknown): error is Error & { code: string } {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

/**
 * Session-scoped cache of computed road/transit routes. Results are derived
 * view data and are never written into the persisted Trip.
 */
export class RouteSegmentStore {
  public constructor(private readonly queryDirections: QueryDirections) {}

  public getSnapshot = (): RouteSegmentSnapshot => this.snapshot;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public ensure(query: RouteSegmentQuery): void {
    if (this.destroyed || this.snapshot.states.has(query.key)) {
      return;
    }
    this.enqueue(query);
  }

  public retry(query: RouteSegmentQuery): void {
    if (
      this.destroyed ||
      this.snapshot.states.get(query.key)?.status !== 'error'
    ) {
      return;
    }
    this.enqueue(query);
  }

  /**
   * Session-only candidate choice. The map and the list read it from the
   * snapshot; it is never written into the persisted Trip.
   */
  public select(key: string, index: number): void {
    if (this.destroyed || this.snapshot.selections.get(key) === index) {
      return;
    }
    const selections = new Map(this.snapshot.selections);
    selections.set(key, index);
    this.snapshot = { ...this.snapshot, selections };
    this.notify();
  }

  public destroy(): void {
    this.destroyed = true;
    this.queue.length = 0;
    this.controller.abort();
    this.listeners.clear();
  }

  private snapshot: RouteSegmentSnapshot = {
    states: new Map(),
    selections: new Map(),
  };
  private readonly listeners = new Set<() => void>();
  private readonly queue: RouteSegmentQuery[] = [];
  private readonly controller = new AbortController();
  private activeRequests = 0;
  private destroyed = false;

  private enqueue(query: RouteSegmentQuery): void {
    this.publish(query.key, LOADING_STATE);
    this.queue.push(query);
    this.drain();
  }

  private drain(): void {
    while (
      !this.destroyed &&
      this.activeRequests < MAX_CONCURRENT_REQUESTS &&
      this.queue.length > 0
    ) {
      const query = this.queue.shift()!;
      this.activeRequests += 1;
      void this.load(query).finally(() => {
        this.activeRequests -= 1;
        this.drain();
      });
    }
  }

  private async load(query: RouteSegmentQuery): Promise<void> {
    try {
      const result = await this.queryDirections(
        query.request,
        this.controller.signal,
      );
      if (this.destroyed) {
        return;
      }
      const candidates = toRouteSegmentCandidates(result);
      this.publish(
        query.key,
        candidates.length > 0
          ? { status: 'ready', candidates }
          : { status: 'error', reason: 'not-found', message: null },
      );
    } catch (error) {
      if (this.destroyed) {
        return;
      }
      this.publish(query.key, RouteSegmentStore.toErrorState(error));
    }
  }

  private static toErrorState(error: unknown): RouteSegmentState {
    if (hasErrorCode(error)) {
      return {
        status: 'error',
        reason:
          error.code === 'ROUTE_NOT_FOUND' ? 'not-found' : 'request-failed',
        message: error.message,
      };
    }
    if (error instanceof DOMException) {
      return { status: 'error', reason: 'timeout', message: null };
    }
    if (error instanceof TypeError) {
      return { status: 'error', reason: 'network', message: null };
    }
    return { status: 'error', reason: 'request-failed', message: null };
  }

  private publish(key: string, state: RouteSegmentState): void {
    const states = new Map(this.snapshot.states);
    states.set(key, state);
    this.snapshot = { ...this.snapshot, states };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
