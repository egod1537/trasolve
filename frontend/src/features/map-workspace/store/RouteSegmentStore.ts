import type { DirectionsRequest, DirectionsResult } from '@trasolve/shared';
import type {
  RouteSegmentQuery,
  RouteSegmentState,
} from '@/features/map-workspace/domain/routeSegment';
import { toRouteSegmentDetail } from '@/features/map-workspace/model/routeViewModel';

export type QueryDirections = (
  request: DirectionsRequest,
  signal: AbortSignal,
) => Promise<DirectionsResult>;

export type RouteSegmentSnapshot = ReadonlyMap<string, RouteSegmentState>;

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
    if (this.destroyed || this.snapshot.has(query.key)) {
      return;
    }
    this.enqueue(query);
  }

  public retry(query: RouteSegmentQuery): void {
    if (this.destroyed || this.snapshot.get(query.key)?.status !== 'error') {
      return;
    }
    this.enqueue(query);
  }

  public destroy(): void {
    this.destroyed = true;
    this.queue.length = 0;
    this.controller.abort();
    this.listeners.clear();
  }

  private snapshot: RouteSegmentSnapshot = new Map();
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
      const detail = toRouteSegmentDetail(result);
      this.publish(
        query.key,
        detail
          ? { status: 'ready', detail }
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
    const next = new Map(this.snapshot);
    next.set(key, state);
    this.snapshot = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
