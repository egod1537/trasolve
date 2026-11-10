import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { ExternalApiOutcome, ExternalApiService } from '@trasolve/shared';
import type { ExternalApiPolicy } from '../../configuration/externalApiPolicy.js';

export interface ExternalApiCallEvent {
  readonly id: string;
  readonly occurredAt: Date;
  readonly actorUserId: string | null;
  readonly service: ExternalApiService;
  readonly operation: string;
  readonly originKind: 'backend' | 'gateway';
  readonly outcome: ExternalApiOutcome;
  readonly httpStatus: number | null;
  readonly durationMs: number | null;
  readonly providerRequestCount: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly contextKind: 'user-request' | 'system';
  readonly errorCode: string | null;
}

export interface ExternalApiUsageWriter {
  append(events: readonly ExternalApiCallEvent[]): Promise<void>;
}

interface RequestContext {
  readonly actorUserId: string | null;
}

const requestContext = new AsyncLocalStorage<RequestContext>();
let recorder: ExternalApiUsageRecorder | null = null;

export class ExternalApiUsageRecorder {
  public constructor(
    private readonly writer: ExternalApiUsageWriter,
    private readonly maximumQueueSize = 1000,
    private readonly batchSize = 50,
  ) {}

  public record(
    event: Omit<
      ExternalApiCallEvent,
      'id' | 'occurredAt' | 'actorUserId' | 'contextKind'
    >,
  ): void {
    if (this.queue.length >= this.maximumQueueSize) {
      this.noteDropped(1);
      return;
    }
    const actorUserId = requestContext.getStore()?.actorUserId ?? null;
    this.queue.push({
      id: randomUUID(),
      occurredAt: new Date(),
      actorUserId,
      contextKind: actorUserId ? 'user-request' : 'system',
      ...event,
    });
    this.scheduleDrain();
  }

  public async flush(): Promise<void> {
    while (this.queue.length > 0 || this.drainPromise) {
      this.scheduleDrain();
      await this.drainPromise;
    }
  }

  public getDroppedCount(): number {
    return this.droppedCount;
  }

  private readonly queue: ExternalApiCallEvent[] = [];
  private drainPromise: Promise<void> | null = null;
  private droppedCount = 0;
  private lastDropLogAt = 0;

  private scheduleDrain(): void {
    if (this.drainPromise || this.queue.length === 0) {
      return;
    }
    this.drainPromise = this.drain().finally(() => {
      this.drainPromise = null;
      if (this.queue.length > 0) {
        this.scheduleDrain();
      }
    });
  }

  private async drain(): Promise<void> {
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await this.writer.append(batch);
    } catch {
      this.noteDropped(batch.length);
    }
  }

  private noteDropped(count: number): void {
    this.droppedCount += count;
    const now = Date.now();
    if (now - this.lastDropLogAt >= 60_000) {
      this.lastDropLogAt = now;
      console.warn(
        JSON.stringify({
          event: 'external_api_usage_dropped',
          droppedCount: this.droppedCount,
        }),
      );
    }
  }
}

export function configureExternalApiUsageRecorder(
  value: ExternalApiUsageRecorder | null,
): void {
  recorder = value;
}

export function runWithExternalApiRequestContext<Result>(
  actorUserId: string | null,
  operation: () => Result,
): Result {
  return requestContext.run({ actorUserId }, operation);
}

export function resolveInstrumentedExternalApiMode(
  policy: ExternalApiPolicy,
  service: ExternalApiService,
  operation: string,
  recordMock = true,
): 'enabled' | 'mock' {
  try {
    const mode = policy.resolve(service, operation);
    if (mode === 'mock' && recordMock) {
      recordExternalApiClassification(service, operation, 'mock');
    }
    return mode;
  } catch (cause) {
    recordExternalApiClassification(service, operation, 'blocked');
    throw cause;
  }
}

export function assertInstrumentedNetworkAllowed(
  policy: ExternalApiPolicy,
  service: ExternalApiService,
  operation: string,
): void {
  try {
    policy.assertNetworkAllowed(service, operation);
  } catch (cause) {
    recordExternalApiClassification(service, operation, 'blocked');
    throw cause;
  }
}

export async function instrumentExternalApiFetch(
  service: ExternalApiService,
  operation: string,
  fetcher: () => Promise<Response>,
  originKind: 'backend' | 'gateway' = 'backend',
): Promise<Response> {
  const startedAt = performance.now();
  try {
    const response = await fetcher();
    record({
      service,
      operation,
      originKind,
      outcome: response.ok ? 'success' : 'http_error',
      httpStatus: response.status,
      durationMs: elapsedMilliseconds(startedAt),
      providerRequestCount: 1,
      inputTokens: null,
      outputTokens: null,
      errorCode: response.ok ? null : `HTTP_${response.status}`,
    });
    return response;
  } catch (cause) {
    record({
      service,
      operation,
      originKind,
      outcome: 'network_error',
      httpStatus: null,
      durationMs: elapsedMilliseconds(startedAt),
      providerRequestCount: 1,
      inputTokens: null,
      outputTokens: null,
      errorCode: normalizeNetworkError(cause),
    });
    throw cause;
  }
}

function recordExternalApiClassification(
  service: ExternalApiService,
  operation: string,
  outcome: 'blocked' | 'mock',
): void {
  record({
    service,
    operation,
    originKind:
      service === 'troute' || service === 'tcache' ? 'gateway' : 'backend',
    outcome,
    httpStatus: null,
    durationMs: null,
    providerRequestCount: 0,
    inputTokens: null,
    outputTokens: null,
    errorCode: outcome === 'blocked' ? 'POLICY_BLOCKED' : null,
  });
}

function record(
  event: Omit<
    ExternalApiCallEvent,
    'id' | 'occurredAt' | 'actorUserId' | 'contextKind'
  >,
): void {
  recorder?.record(event);
}

function elapsedMilliseconds(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function normalizeNetworkError(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return 'ABORTED';
  }
  if (cause instanceof Error && cause.name === 'TimeoutError') {
    return 'TIMEOUT';
  }
  return 'NETWORK_ERROR';
}
