import {
  analyticsEventTypeSchema,
  analyticsScreenSchema,
  type AnalyticsEvent,
  type AnalyticsEventType,
  type AnalyticsScreen,
  type AnalyticsSessionSummary,
} from '@trasolve/shared';
import { z } from 'zod';

export type AnalyticsRawEventFilters = {
  from?: string;
  to?: string;
  sessionId?: string;
  eventType?: AnalyticsEventType;
  screen?: AnalyticsScreen;
  userId?: string;
  anonymous?: boolean;
  offset?: number;
  limit?: number;
};

export type AnalyticsSessionListOptions = Omit<
  AnalyticsRawEventFilters,
  'sessionId'
>;

export type AnalyticsSessionSummaryQuery = Omit<
  AnalyticsRawEventFilters,
  'sessionId'
>;

export type AnalyticsSessionSummaryResult = {
  sessions: readonly AnalyticsSessionSummary[];
  hasMore: boolean;
};

export interface AnalyticsRepository {
  /** The caller must derive event.userId from backend authentication context. */
  append(event: AnalyticsEvent): Promise<void>;
  listBySession(
    sessionId: string,
    options?: AnalyticsSessionListOptions,
  ): Promise<readonly AnalyticsEvent[]>;
  listSessions(
    query?: AnalyticsSessionSummaryQuery,
  ): Promise<AnalyticsSessionSummaryResult>;
  queryRaw(filters?: AnalyticsRawEventFilters): AsyncIterable<AnalyticsEvent>;
}

/** @deprecated Use AnalyticsRepository. */
export type AnalyticsEventRepository = AnalyticsRepository;

export type AnalyticsEventStorageErrorKind =
  | 'invalid_event'
  | 'invalid_query'
  | 'invalid_stored_event'
  | 'malformed_line'
  | 'read_failed'
  | 'write_failed';

export class AnalyticsEventStorageError extends Error {
  public constructor(
    public readonly kind: AnalyticsEventStorageErrorKind,
    message: string,
    options?: { cause?: unknown; lineNumber?: number },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AnalyticsEventStorageError';
    this.lineNumber = options?.lineNumber;
  }

  public readonly lineNumber: number | undefined;
}

const analyticsRawEventFiltersSchema = z
  .strictObject({
    from: z.iso.datetime({ offset: false }).optional(),
    to: z.iso.datetime({ offset: false }).optional(),
    sessionId: z.string().min(1).optional(),
    eventType: analyticsEventTypeSchema.optional(),
    screen: analyticsScreenSchema.optional(),
    userId: z.uuid().optional(),
    anonymous: z.boolean().optional(),
    offset: z.number().int().nonnegative().optional(),
    limit: z.number().int().positive().max(1000).optional(),
  })
  .refine(
    (filters) =>
      filters.from === undefined ||
      filters.to === undefined ||
      Date.parse(filters.from) <= Date.parse(filters.to),
    { message: 'Analytics event query range is invalid.' },
  )
  .refine(
    (filters) => filters.userId === undefined || filters.anonymous !== true,
    {
      message: 'An exact analytics user query cannot require anonymous events.',
    },
  );

const analyticsSessionListOptionsSchema =
  analyticsRawEventFiltersSchema.safeExtend({
    sessionId: z.undefined().optional(),
  });

const analyticsSessionSummaryQuerySchema =
  analyticsRawEventFiltersSchema.safeExtend({
    sessionId: z.undefined().optional(),
  });

export function parseAnalyticsRawEventFilters(
  input: AnalyticsRawEventFilters,
): AnalyticsRawEventFilters {
  const parsed = analyticsRawEventFiltersSchema.safeParse(input);
  if (!parsed.success) {
    throw new AnalyticsEventStorageError(
      'invalid_query',
      'Analytics event query is invalid.',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

export function parseAnalyticsSessionQuery(
  sessionId: string,
  options: AnalyticsSessionListOptions,
): AnalyticsRawEventFilters {
  const parsedSessionId = z.string().min(1).safeParse(sessionId);
  const parsedOptions = analyticsSessionListOptionsSchema.safeParse(options);
  if (!parsedSessionId.success || !parsedOptions.success) {
    throw new AnalyticsEventStorageError(
      'invalid_query',
      'Analytics session query is invalid.',
      {
        cause: parsedSessionId.success
          ? parsedOptions.error
          : parsedSessionId.error,
      },
    );
  }
  return { ...parsedOptions.data, sessionId: parsedSessionId.data };
}

export function parseAnalyticsSessionSummaryQuery(
  input: AnalyticsSessionSummaryQuery,
): AnalyticsSessionSummaryQuery {
  const parsed = analyticsSessionSummaryQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new AnalyticsEventStorageError(
      'invalid_query',
      'Analytics session summary query is invalid.',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}
