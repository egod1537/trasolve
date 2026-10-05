import {
  analyticsEventSchema,
  analyticsSessionSummarySchema,
  type AnalyticsEvent,
  type AnalyticsSessionSummary,
} from '@trasolve/shared';
import type { QueryResultRow } from 'pg';
import type { DatabaseExecutor } from '../database/database.js';
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

interface AnalyticsEventRow extends QueryResultRow {
  readonly id: string;
  readonly session_id: string;
  readonly user_id: string | null;
  readonly event_type: string;
  readonly screen: string;
  readonly target: string | null;
  readonly occurred_at: Date | string;
  readonly metadata: unknown;
  readonly created_at: Date | string;
}

interface AnalyticsSessionSummaryRow extends QueryResultRow {
  readonly session_id: string;
  readonly started_at: Date | string;
  readonly ended_at: Date | string;
  readonly event_count: string;
  readonly path_length: string;
  readonly user_ids: string[];
  readonly has_anonymous_events: boolean;
}

const analyticsEventColumns = `
  id,
  session_id,
  user_id,
  event_type,
  screen,
  target,
  occurred_at,
  metadata,
  created_at
`;

export class PostgresAnalyticsRepository implements AnalyticsRepository {
  public constructor(private readonly database: DatabaseExecutor) {}

  public async append(eventInput: AnalyticsEvent): Promise<void> {
    const parsed = analyticsEventSchema.safeParse(eventInput);
    if (!parsed.success) {
      throw new AnalyticsEventStorageError(
        'invalid_event',
        'Analytics event is invalid for persistence.',
        { cause: parsed.error },
      );
    }
    const event = parsed.data;

    try {
      await this.database.query(
        `INSERT INTO trasolve.analytics_events (
           id,
           session_id,
           user_id,
           event_type,
           screen,
           target,
           occurred_at,
           metadata
         )
         VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7::timestamptz, $8::jsonb)`,
        [
          event.id,
          event.sessionId,
          event.userId,
          event.eventType,
          event.screen,
          event.target,
          event.timestamp,
          event.metadata === null ? null : JSON.stringify(event.metadata),
        ],
      );
    } catch (cause) {
      throw new AnalyticsEventStorageError(
        'write_failed',
        'Analytics event could not be appended.',
        { cause },
      );
    }
  }

  public async listBySession(
    sessionId: string,
    options: AnalyticsSessionListOptions = {},
  ): Promise<readonly AnalyticsEvent[]> {
    const filters = parseAnalyticsSessionQuery(sessionId, options);
    return this.read(filters, 'occurred_at ASC, created_at ASC, id ASC');
  }

  public async listSessions(
    queryInput: AnalyticsSessionSummaryQuery = {},
  ): Promise<AnalyticsSessionSummaryResult> {
    const query = parseAnalyticsSessionSummaryQuery(queryInput);
    const { offset = 0, limit, ...filters } = query;
    const { where, values } = buildWhere(filters);
    const pagination = appendPagination(values, offset, limit, true);

    try {
      const result = await this.database.query<AnalyticsSessionSummaryRow>(
        `WITH filtered_events AS (
           SELECT
             id,
             session_id,
             user_id,
             event_type,
             screen,
             occurred_at,
             CASE
               WHEN event_type = 'screen_view' THEN 'screen:' || screen
               WHEN event_type IN (
                 'add_place',
                 'remove_place',
                 'optimize_start',
                 'optimize_complete',
                 'result_view',
                 'share_enable',
                 'share_link_copy',
                 'shared_trip_view'
               ) THEN 'event:' || event_type
               ELSE NULL
             END AS analysis_node
           FROM trasolve.analytics_events
           ${where}
         ),
         ordered_nodes AS (
           SELECT
             session_id,
             analysis_node,
             lag(analysis_node) OVER (
               PARTITION BY session_id
               ORDER BY occurred_at ASC, id ASC
             ) AS previous_node
           FROM filtered_events
           WHERE analysis_node IS NOT NULL
         ),
         path_lengths AS (
           SELECT
             session_id,
             count(*) FILTER (
               WHERE analysis_node IS DISTINCT FROM previous_node
             ) AS path_length
           FROM ordered_nodes
           GROUP BY session_id
         )
         SELECT
           events.session_id,
           min(events.occurred_at) AS started_at,
           max(events.occurred_at) AS ended_at,
           count(*) AS event_count,
           COALESCE(max(paths.path_length), 0) AS path_length,
           COALESCE(
             array_agg(DISTINCT events.user_id ORDER BY events.user_id)
               FILTER (WHERE events.user_id IS NOT NULL),
             ARRAY[]::uuid[]
           ) AS user_ids,
           bool_or(events.user_id IS NULL) AS has_anonymous_events
         FROM filtered_events AS events
         LEFT JOIN path_lengths AS paths USING (session_id)
         GROUP BY events.session_id
         ORDER BY started_at DESC, session_id ASC
         ${pagination}`,
        values,
      );
      const rows = result.rows.map(mapAnalyticsSessionSummaryRow);
      const hasMore = limit !== undefined && rows.length > limit;
      return {
        sessions: hasMore ? rows.slice(0, limit) : rows,
        hasMore,
      };
    } catch (cause) {
      if (cause instanceof AnalyticsEventStorageError) {
        throw cause;
      }
      throw new AnalyticsEventStorageError(
        'read_failed',
        'Analytics sessions could not be read.',
        { cause },
      );
    }
  }

  public async *queryRaw(
    filtersInput: AnalyticsRawEventFilters = {},
  ): AsyncGenerator<AnalyticsEvent> {
    const filters = parseAnalyticsRawEventFilters(filtersInput);
    const events = await this.read(filters, 'created_at ASC, id ASC');
    yield* events;
  }

  private async read(
    filters: AnalyticsRawEventFilters,
    ordering: string,
  ): Promise<readonly AnalyticsEvent[]> {
    const { offset = 0, limit, ...eventFilters } = filters;
    const { where, values } = buildWhere(eventFilters);
    const pagination = appendPagination(values, offset, limit, false);
    try {
      const result = await this.database.query<AnalyticsEventRow>(
        `SELECT ${analyticsEventColumns}
         FROM trasolve.analytics_events
         ${where}
         ORDER BY ${ordering}
         ${pagination}`,
        values,
      );
      return result.rows.map(mapAnalyticsEventRow);
    } catch (cause) {
      if (cause instanceof AnalyticsEventStorageError) {
        throw cause;
      }
      throw new AnalyticsEventStorageError(
        'read_failed',
        'Analytics events could not be read.',
        { cause },
      );
    }
  }
}

function buildWhere(filters: AnalyticsRawEventFilters): {
  where: string;
  values: unknown[];
} {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const addClause = (
    column: string,
    operator: string,
    value: unknown,
  ): void => {
    values.push(value);
    clauses.push(`${column} ${operator} $${values.length}`);
  };

  if (filters.sessionId !== undefined) {
    addClause('session_id', '=', filters.sessionId);
  }
  if (filters.eventType !== undefined) {
    addClause('event_type', '=', filters.eventType);
  }
  if (filters.screen !== undefined) {
    addClause('screen', '=', filters.screen);
  }
  if (filters.userId !== undefined) {
    addClause('user_id', '=', filters.userId);
  }
  if (filters.anonymous === true) {
    clauses.push('user_id IS NULL');
  } else if (filters.anonymous === false) {
    clauses.push('user_id IS NOT NULL');
  }
  if (filters.from !== undefined) {
    addClause('occurred_at', '>=', filters.from);
  }
  if (filters.to !== undefined) {
    addClause('occurred_at', '<=', filters.to);
  }

  return {
    where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

function appendPagination(
  values: unknown[],
  offset: number,
  limit: number | undefined,
  requestLookahead: boolean,
): string {
  const clauses: string[] = [];
  if (limit !== undefined) {
    values.push(requestLookahead ? limit + 1 : limit);
    clauses.push(`LIMIT $${values.length}`);
  }
  if (offset > 0) {
    values.push(offset);
    clauses.push(`OFFSET $${values.length}`);
  }
  return clauses.join(' ');
}

function mapAnalyticsEventRow(row: AnalyticsEventRow): AnalyticsEvent {
  const timestamp = toIsoTimestamp(row.occurred_at);
  try {
    return analyticsEventSchema.parse({
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      eventType: row.event_type,
      screen: row.screen,
      target: row.target,
      timestamp,
      metadata: row.metadata,
    });
  } catch (cause) {
    throw new AnalyticsEventStorageError(
      'invalid_stored_event',
      'Stored analytics event is invalid.',
      { cause },
    );
  }
}

function mapAnalyticsSessionSummaryRow(
  row: AnalyticsSessionSummaryRow,
): AnalyticsSessionSummary {
  try {
    return analyticsSessionSummarySchema.parse({
      sessionId: row.session_id,
      startedAt: toIsoTimestamp(row.started_at),
      endedAt: toIsoTimestamp(row.ended_at),
      eventCount: Number(row.event_count),
      pathLength: Number(row.path_length),
      userIds: row.user_ids,
      hasAnonymousEvents: row.has_anonymous_events,
    });
  } catch (cause) {
    if (cause instanceof AnalyticsEventStorageError) {
      throw cause;
    }
    throw new AnalyticsEventStorageError(
      'invalid_stored_event',
      'Stored analytics session summary is invalid.',
      { cause },
    );
  }
}

function toIsoTimestamp(value: Date | string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.valueOf())) {
    throw new AnalyticsEventStorageError(
      'invalid_stored_event',
      'Stored analytics event timestamp is invalid.',
    );
  }
  return timestamp.toISOString();
}
