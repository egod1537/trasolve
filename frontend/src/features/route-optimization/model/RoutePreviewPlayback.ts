import { TROUTE_MAX_PREVIEW_FRAMES } from '@trasolve/shared';
import type { RouteComparisonData } from './routeComparison';

const FRAME_INTERVAL_MS = 1000;
const MIN_PLAYBACK_MS = 10000;

type Illustrate = (
  previous: RouteComparisonData | null,
) => RouteComparisonData | null;

function signature(data: RouteComparisonData): string {
  return JSON.stringify([data.update.placeIds, data.update.stops]);
}

/** A UI clock independent of network arrivals; illustrative routes fill empty ticks. */
export class RoutePreviewPlayback {
  public constructor(
    private readonly show: (data: RouteComparisonData) => void,
    private readonly illustrate: Illustrate,
  ) {
    this.schedule();
  }

  public receive(data: RouteComparisonData): void {
    const revision = data.live?.revision ?? 0;
    if (this.stopped || this.completion || revision <= this.lastRevision) {
      return;
    }
    this.lastRevision = revision;
    const nextSignature = signature(data);
    if (nextSignature === this.lastSignature) {
      return;
    }
    this.lastSignature = nextSignature;
    // Bound retained history independently of how long the request takes.
    if (this.pending.length < TROUTE_MAX_PREVIEW_FRAMES) {
      this.pending.push(data);
    } else {
      this.pending[TROUTE_MAX_PREVIEW_FRAMES - 1] = data;
    }
  }

  public finish(data: RouteComparisonData, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.stopped || this.completion) {
      return Promise.reject(new DOMException('Playback stopped', 'AbortError'));
    }
    const finalSignature = signature(data);
    this.pending = this.pending.filter(
      (frame) => signature(frame) !== finalSignature,
    );
    return new Promise<void>((resolve, reject) => {
      const abort = () => this.stop();
      signal.addEventListener('abort', abort, { once: true });
      this.completion = {
        resolve,
        reject,
        cleanup: () => signal.removeEventListener('abort', abort),
      };
      // Recompute the next wake-up against the same clock. A late final result
      // can finish immediately instead of waiting for another shuffle tick.
      if (this.timer !== null) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.schedule();
    });
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = null;
    this.pending = [];
    this.completion?.cleanup();
    this.completion?.reject(new DOMException('Playback stopped', 'AbortError'));
    this.completion = null;
  }

  private readonly startedAt = performance.now();
  private pending: RouteComparisonData[] = [];
  private previous: RouteComparisonData | null = null;
  private ticks = 0;
  private lastRevision = 0;
  private lastSignature: string | null = null;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private completion: {
    resolve: () => void;
    reject: (error: Error) => void;
    cleanup: () => void;
  } | null = null;

  private schedule(): void {
    if (this.stopped || this.timer !== null) {
      return;
    }
    const nextTick = this.startedAt + (this.ticks + 1) * FRAME_INTERVAL_MS;
    const due = this.completion
      ? Math.min(this.startedAt + MIN_PLAYBACK_MS, nextTick)
      : nextTick;
    this.timer = setTimeout(
      () => this.advance(),
      Math.max(0, due - performance.now()),
    );
  }

  private advance(): void {
    this.timer = null;
    if (this.stopped) {
      return;
    }
    if (
      this.completion &&
      performance.now() >= this.startedAt + MIN_PLAYBACK_MS
    ) {
      const completion = this.completion;
      this.completion = null;
      this.stopped = true;
      this.pending = [];
      completion.cleanup();
      completion.resolve();
      return;
    }
    this.ticks += 1;
    const next = this.pending.shift() ?? this.illustrate(this.previous);
    if (next) {
      this.previous = next;
      this.show(next);
    }
    this.schedule();
  }
}
