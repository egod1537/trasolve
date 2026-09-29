import { createReadStream } from 'node:fs';
import { mkdir, open, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import {
  analyticsEventSchema,
  type AnalyticsEvent,
  type AnalyticsSessionSummary,
} from '@trasolve/shared';
import {
  AnalyticsEventStorageError,
  parseAnalyticsRawEventFilters,
  parseAnalyticsSessionQuery,
  parseAnalyticsSessionSummaryQuery,
  type AnalyticsRepository,
  type AnalyticsRawEventFilters,
  type AnalyticsSessionListOptions,
  type AnalyticsSessionSummaryQuery,
  type AnalyticsSessionSummaryResult,
} from './analyticsEventRepository.js';
import { buildAnalyticsSessionPaths } from './flowAggregation.js';

export class LocalNdjsonAnalyticsEventRepository implements AnalyticsRepository {
  public constructor(options: { rootDir: string }) {
    this.eventsPath = resolve(options.rootDir, 'analytics', 'events.ndjson');
  }

  public append(eventInput: AnalyticsEvent): Promise<void> {
    const parsed = analyticsEventSchema.safeParse(eventInput);
    if (!parsed.success) {
      return Promise.reject(
        new AnalyticsEventStorageError(
          'invalid_event',
          'Analytics event is invalid for persistence.',
          { cause: parsed.error },
        ),
      );
    }
    return this.enqueue(() => this.appendValidated(parsed.data));
  }

  public async listBySession(
    sessionId: string,
    options: AnalyticsSessionListOptions = {},
  ): Promise<readonly AnalyticsEvent[]> {
    const filters = parseAnalyticsSessionQuery(sessionId, options);
    const { offset = 0, limit, ...unpagedFilters } = filters;
    const events: Array<{ event: AnalyticsEvent; appendOrder: number }> = [];
    let appendOrder = 0;
    for await (const event of this.queryRaw(unpagedFilters)) {
      events.push({ event, appendOrder });
      appendOrder += 1;
    }
    events.sort((left, right) => {
      const timestampDifference =
        Date.parse(left.event.timestamp) - Date.parse(right.event.timestamp);
      if (timestampDifference !== 0) {
        return timestampDifference;
      }
      const appendDifference = left.appendOrder - right.appendOrder;
      return appendDifference || left.event.id.localeCompare(right.event.id);
    });
    const ordered = events.map(({ event }) => event);
    return ordered.slice(
      offset,
      limit === undefined ? undefined : offset + limit,
    );
  }

  public async listSessions(
    queryInput: AnalyticsSessionSummaryQuery = {},
  ): Promise<AnalyticsSessionSummaryResult> {
    const query = parseAnalyticsSessionSummaryQuery(queryInput);
    const { offset = 0, limit, ...filters } = query;
    const sessions = new Map<
      string,
      AnalyticsSessionSummary & { userIdSet: Set<string> }
    >();
    const matchedEvents: AnalyticsEvent[] = [];

    for await (const event of this.queryRaw(filters)) {
      matchedEvents.push(event);
      const existing = sessions.get(event.sessionId);
      if (!existing) {
        sessions.set(event.sessionId, {
          sessionId: event.sessionId,
          startedAt: event.timestamp,
          endedAt: event.timestamp,
          eventCount: 1,
          pathLength: 0,
          userIds: event.userId === null ? [] : [event.userId],
          hasAnonymousEvents: event.userId === null,
          userIdSet: new Set(event.userId === null ? [] : [event.userId]),
        });
        continue;
      }

      if (Date.parse(event.timestamp) < Date.parse(existing.startedAt)) {
        existing.startedAt = event.timestamp;
      }
      if (Date.parse(event.timestamp) > Date.parse(existing.endedAt)) {
        existing.endedAt = event.timestamp;
      }
      existing.eventCount += 1;
      existing.hasAnonymousEvents ||= event.userId === null;
      if (event.userId !== null) {
        existing.userIdSet.add(event.userId);
      }
    }

    const paths = await buildAnalyticsSessionPaths(matchedEvents);
    const pathLengths = new Map(
      paths.sessions.map(({ sessionId, nodes }) => [sessionId, nodes.length]),
    );

    const summaries = [...sessions.values()]
      .map(({ userIdSet, ...summary }) => ({
        ...summary,
        pathLength: pathLengths.get(summary.sessionId) ?? 0,
        userIds: [...userIdSet].sort(),
      }))
      .sort(
        (left, right) =>
          Date.parse(right.startedAt) - Date.parse(left.startedAt) ||
          left.sessionId.localeCompare(right.sessionId),
      );
    const page = summaries.slice(
      offset,
      limit === undefined ? undefined : offset + limit + 1,
    );
    const hasMore = limit !== undefined && page.length > limit;
    return {
      sessions: hasMore ? page.slice(0, limit) : page,
      hasMore,
    };
  }

  public async *queryRaw(
    filtersInput: AnalyticsRawEventFilters = {},
  ): AsyncGenerator<AnalyticsEvent> {
    const parsedFilters = parseAnalyticsRawEventFilters(filtersInput);
    const { offset = 0, limit, ...filters } = parsedFilters;

    const snapshotSize = await this.enqueue(() => this.getSnapshotSize());
    if (snapshotSize === 0) {
      return;
    }

    const stream = createReadStream(this.eventsPath, {
      encoding: 'utf8',
      start: 0,
      end: snapshotSize - 1,
    });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    let lineNumber = 0;
    let matchedCount = 0;
    let yieldedCount = 0;
    try {
      for await (const line of lines) {
        lineNumber += 1;
        const event = this.parseLine(line, lineNumber);
        if (this.matches(event, filters)) {
          if (matchedCount < offset) {
            matchedCount += 1;
            continue;
          }
          if (limit !== undefined && yieldedCount >= limit) {
            return;
          }
          yield event;
          matchedCount += 1;
          yieldedCount += 1;
        }
      }
    } catch (cause) {
      if (cause instanceof AnalyticsEventStorageError) {
        throw cause;
      }
      throw new AnalyticsEventStorageError(
        'read_failed',
        'Analytics event storage could not be read.',
        { cause, lineNumber: lineNumber || undefined },
      );
    } finally {
      lines.close();
      stream.destroy();
    }
  }

  private readonly eventsPath: string;
  private operationTail: Promise<void> = Promise.resolve();

  private async appendValidated(event: AnalyticsEvent): Promise<void> {
    try {
      await mkdir(dirname(this.eventsPath), { recursive: true });
      const file = await open(this.eventsPath, 'a+', 0o600);
      try {
        await this.assertAppendBoundary(file);
        await file.writeFile(`${JSON.stringify(event)}\n`, {
          encoding: 'utf8',
        });
        await file.sync();
      } finally {
        await file.close();
      }
    } catch (cause) {
      if (cause instanceof AnalyticsEventStorageError) {
        throw cause;
      }
      throw new AnalyticsEventStorageError(
        'write_failed',
        'Analytics event could not be appended.',
        { cause },
      );
    }
  }

  private async assertAppendBoundary(
    file: Awaited<ReturnType<typeof open>>,
  ): Promise<void> {
    const fileStats = await file.stat();
    if (fileStats.size === 0) {
      return;
    }
    const lastByte = Buffer.allocUnsafe(1);
    const result = await file.read(lastByte, 0, 1, fileStats.size - 1);
    if (result.bytesRead !== 1 || lastByte[0] !== 0x0a) {
      throw new AnalyticsEventStorageError(
        'malformed_line',
        'Analytics event storage does not end with a complete NDJSON line.',
      );
    }
  }

  private async getSnapshotSize(): Promise<number> {
    try {
      return (await stat(this.eventsPath)).size;
    } catch (cause) {
      if (this.isMissing(cause)) {
        return 0;
      }
      throw new AnalyticsEventStorageError(
        'read_failed',
        'Analytics event storage metadata could not be read.',
        { cause },
      );
    }
  }

  private parseLine(line: string, lineNumber: number): AnalyticsEvent {
    try {
      return analyticsEventSchema.parse(JSON.parse(line));
    } catch (cause) {
      throw new AnalyticsEventStorageError(
        'malformed_line',
        `Analytics event storage contains an invalid line at ${lineNumber}.`,
        { cause, lineNumber },
      );
    }
  }

  private matches(
    event: AnalyticsEvent,
    filters: AnalyticsRawEventFilters,
  ): boolean {
    if (filters.sessionId && event.sessionId !== filters.sessionId) {
      return false;
    }
    if (filters.eventType && event.eventType !== filters.eventType) {
      return false;
    }
    if (filters.screen && event.screen !== filters.screen) {
      return false;
    }
    if (filters.userId && event.userId !== filters.userId) {
      return false;
    }
    if (filters.anonymous === true && event.userId !== null) {
      return false;
    }
    if (filters.anonymous === false && event.userId === null) {
      return false;
    }
    const timestamp = Date.parse(event.timestamp);
    if (filters.from && timestamp < Date.parse(filters.from)) {
      return false;
    }
    if (filters.to && timestamp > Date.parse(filters.to)) {
      return false;
    }
    return true;
  }

  private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const pending = this.operationTail.then(operation);
    this.operationTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  private isMissing(cause: unknown): boolean {
    return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
  }
}
