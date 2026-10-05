import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  analyticsEventPageSchema,
  analyticsEventTypeSchema,
  analyticsFunnelResultResponseSchema,
  analyticsFlowResponseSchema,
  analyticsOverviewResponseSchema,
  analyticsScreenSchema,
  analyticsSessionPageSchema,
  funnelAggregationFiltersSchema,
  type AnalyticsEvent,
  type ApiErrorResponse,
} from '@trasolve/shared';
import { z } from 'zod';
import type {
  AnalyticsRepository,
  AnalyticsSessionSummaryQuery,
} from './analyticsEventRepository.js';
import { aggregateAnalyticsFlow } from './flowAggregation.js';
import {
  aggregateAnalyticsTargets,
  analyzeAnalyticsQuality,
} from './qualityAnalysis.js';
import {
  FunnelAggregationService,
  FunnelNotFoundError,
} from './funnels/funnelAggregationService.js';

const defaultPageSize = 50;
const maximumPageSize = 200;
const allowedSessionQueryParameters = new Set([
  'from',
  'to',
  'eventType',
  'screen',
  'userId',
  'anonymous',
  'limit',
  'cursor',
]);
const allowedFlowQueryParameters = new Set([
  'from',
  'to',
  'eventType',
  'screen',
  'minimumCount',
  'nodeMode',
]);
const allowedOverviewQueryParameters = new Set(['from', 'to']);
const allowedFunnelQueryParameters = new Set(['from', 'to', 'locale']);

const analyticsReadFiltersSchema = z
  .strictObject({
    from: z.iso.datetime({ offset: false }).optional(),
    to: z.iso.datetime({ offset: false }).optional(),
    eventType: analyticsEventTypeSchema.optional(),
    screen: analyticsScreenSchema.optional(),
    userId: z.uuid().optional(),
    anonymous: z.boolean().optional(),
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

type AnalyticsReadFilters = z.infer<typeof analyticsReadFiltersSchema>;

const analyticsFlowQuerySchema = z
  .strictObject({
    from: z.iso.datetime({ offset: false }).optional(),
    to: z.iso.datetime({ offset: false }).optional(),
    eventType: analyticsEventTypeSchema.optional(),
    screen: analyticsScreenSchema.optional(),
    minimumCount: z.number().int().positive().max(1_000_000),
    nodeMode: z.enum(['screen', 'domain_event', 'mixed']),
  })
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      Date.parse(query.from) <= Date.parse(query.to),
    { message: 'Analytics flow query range is invalid.' },
  );

const analyticsOverviewQuerySchema = z
  .strictObject({
    from: z.iso.datetime({ offset: false }).optional(),
    to: z.iso.datetime({ offset: false }).optional(),
  })
  .refine(
    (query) =>
      query.from === undefined ||
      query.to === undefined ||
      Date.parse(query.from) <= Date.parse(query.to),
    { message: 'Analytics overview query range is invalid.' },
  );

export class AnalyticsQueryHttpService {
  public constructor(
    repository: AnalyticsRepository,
    options: { readEnabled: boolean },
  ) {
    this.repository = repository;
    this.options = options;
    this.funnelAggregation = new FunnelAggregationService(repository);
  }

  public async handleFunnels(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<void> {
    await this.respond(request, response, async () => {
      this.requireEmptyQuery(requestUrl.searchParams);
      return this.funnelAggregation.listFunnels();
    });
  }

  public async handleFunnelResult(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
    encodedFunnelId: string,
  ): Promise<void> {
    await this.respond(request, response, async () => {
      const funnelId = this.decodePathSegment(encodedFunnelId);
      const filters = this.parseFunnelQuery(requestUrl.searchParams);
      const result = await this.funnelAggregation.aggregate(funnelId, filters);
      return analyticsFunnelResultResponseSchema.parse({
        ...result,
        range: {
          from: filters.from ?? null,
          to: filters.to ?? null,
          locale: filters.locale ?? null,
        },
      });
    });
  }

  public async handleSessions(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<void> {
    await this.respond(request, response, async () => {
      const query = this.parseQuery(requestUrl.searchParams);
      const result = await this.repository.listSessions({
        ...query.filters,
        offset: query.offset,
        limit: query.limit,
      } satisfies AnalyticsSessionSummaryQuery);
      return analyticsSessionPageSchema.parse({
        sessions: result.sessions,
        nextCursor: result.hasMore
          ? this.encodeCursor(query.offset + query.limit)
          : null,
      });
    });
  }

  public async handleFlows(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<void> {
    await this.respond(request, response, async () => {
      const query = this.parseFlowQuery(requestUrl.searchParams);
      const result = await aggregateAnalyticsFlow(
        this.repository.queryRaw({
          ...(query.from === undefined ? {} : { from: query.from }),
          ...(query.to === undefined ? {} : { to: query.to }),
          ...(query.eventType === undefined
            ? {}
            : { eventType: query.eventType }),
          ...(query.screen === undefined ? {} : { screen: query.screen }),
        }),
        { nodeMode: query.nodeMode },
      );
      const nodes = result.nodes
        .filter((node) => node.count >= query.minimumCount)
        .map((node) =>
          node.kind === 'screen'
            ? {
                id: node.id,
                kind: node.kind,
                identifier: node.screen,
                visits: node.count,
                sessions: node.uniqueSessions,
              }
            : {
                id: node.id,
                kind: node.kind,
                identifier: node.eventType,
                visits: node.count,
                sessions: node.uniqueSessions,
              },
        );
      const nodeIds = new Set(nodes.map(({ id }) => id));
      const edges = result.edges
        .filter(
          (edge) =>
            edge.count >= query.minimumCount &&
            nodeIds.has(edge.source) &&
            nodeIds.has(edge.target),
        )
        .map((edge) => ({
          source: edge.source,
          target: edge.target,
          count: edge.count,
          ratio: edge.outgoingRatio,
          sessions: edge.uniqueSessions,
        }));

      return analyticsFlowResponseSchema.parse({
        summary: {
          sessions: result.summary.sessionCount,
          events: result.summary.eventCount,
          avgPathLength:
            result.summary.sessionCount === 0
              ? 0
              : result.summary.nodeOccurrenceCount /
                result.summary.sessionCount,
        },
        nodes,
        edges,
      });
    });
  }

  public async handleOverview(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<void> {
    await this.respond(request, response, async () => {
      const query = this.parseOverviewQuery(requestUrl.searchParams);
      const events: AnalyticsEvent[] = [];
      for await (const event of this.repository.queryRaw({
        ...(query.from === undefined ? {} : { from: query.from }),
        ...(query.to === undefined ? {} : { to: query.to }),
      })) {
        events.push(event);
      }
      const result = await analyzeAnalyticsQuality(events);
      return analyticsOverviewResponseSchema.parse({
        ...result,
        targets: aggregateAnalyticsTargets(events),
      });
    });
  }

  public async handleSessionEvents(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
    encodedSessionId: string,
  ): Promise<void> {
    await this.respond(request, response, async () => {
      const sessionId = this.decodeSessionId(encodedSessionId);
      const query = this.parseQuery(requestUrl.searchParams);
      const events = await this.repository.listBySession(sessionId, {
        ...query.filters,
        offset: query.offset,
        limit: query.limit + 1,
      });
      const hasMore = events.length > query.limit;
      return analyticsEventPageSchema.parse({
        events: hasMore ? events.slice(0, query.limit) : events,
        nextCursor: hasMore
          ? this.encodeCursor(query.offset + query.limit)
          : null,
      });
    });
  }

  private readonly repository: AnalyticsRepository;
  private readonly options: { readEnabled: boolean };
  private readonly funnelAggregation: FunnelAggregationService;

  private async respond(
    request: IncomingMessage,
    response: ServerResponse,
    operation: () => Promise<unknown>,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      if (request.method !== 'GET') {
        response.setHeader('Allow', 'GET');
        throw new AnalyticsQueryHttpError(
          405,
          'METHOD_NOT_ALLOWED',
          'Method not allowed.',
        );
      }
      if (!this.options.readEnabled) {
        throw new AnalyticsQueryHttpError(
          403,
          'ANALYTICS_READ_FORBIDDEN',
          'Analytics read access is not available.',
        );
      }

      const body = await operation();
      if (!response.destroyed) {
        response.writeHead(200);
        response.end(JSON.stringify(body));
      }
    } catch (cause) {
      if (response.destroyed) {
        return;
      }
      const error =
        cause instanceof AnalyticsQueryHttpError
          ? cause
          : cause instanceof FunnelNotFoundError
            ? new AnalyticsQueryHttpError(
                404,
                'ANALYTICS_FUNNEL_NOT_FOUND',
                'Analytics funnel was not found.',
              )
            : new AnalyticsQueryHttpError(
                503,
                'ANALYTICS_STORAGE_UNAVAILABLE',
                'Analytics storage is unavailable.',
              );
      const body: ApiErrorResponse = {
        error: { code: error.code, message: error.message },
      };
      response.writeHead(error.status);
      response.end(JSON.stringify(body));
    }
  }

  private parseQuery(searchParams: URLSearchParams): {
    filters: AnalyticsReadFilters;
    offset: number;
    limit: number;
  } {
    for (const key of new Set(searchParams.keys())) {
      if (
        !allowedSessionQueryParameters.has(key) ||
        searchParams.getAll(key).length !== 1
      ) {
        throw this.invalidQuery();
      }
    }

    const anonymous = this.parseOptionalBoolean(searchParams.get('anonymous'));
    const filters = analyticsReadFiltersSchema.safeParse({
      ...(searchParams.has('from') ? { from: searchParams.get('from') } : {}),
      ...(searchParams.has('to') ? { to: searchParams.get('to') } : {}),
      ...(searchParams.has('eventType')
        ? { eventType: searchParams.get('eventType') }
        : {}),
      ...(searchParams.has('screen')
        ? { screen: searchParams.get('screen') }
        : {}),
      ...(searchParams.has('userId')
        ? { userId: searchParams.get('userId') }
        : {}),
      ...(anonymous === undefined ? {} : { anonymous }),
    });
    if (!filters.success) {
      throw this.invalidQuery();
    }

    return {
      filters: filters.data,
      offset: this.decodeCursor(searchParams.get('cursor')),
      limit: this.parseLimit(searchParams.get('limit')),
    };
  }

  private parseFlowQuery(searchParams: URLSearchParams) {
    for (const key of new Set(searchParams.keys())) {
      if (
        !allowedFlowQueryParameters.has(key) ||
        searchParams.getAll(key).length !== 1
      ) {
        throw this.invalidQuery();
      }
    }

    const minimumCountValue = searchParams.get('minimumCount');
    const minimumCount =
      minimumCountValue === null
        ? 1
        : this.parsePositiveInteger(minimumCountValue);
    const parsed = analyticsFlowQuerySchema.safeParse({
      ...(searchParams.has('from') ? { from: searchParams.get('from') } : {}),
      ...(searchParams.has('to') ? { to: searchParams.get('to') } : {}),
      ...(searchParams.has('eventType')
        ? { eventType: searchParams.get('eventType') }
        : {}),
      ...(searchParams.has('screen')
        ? { screen: searchParams.get('screen') }
        : {}),
      minimumCount,
      nodeMode: searchParams.get('nodeMode') ?? 'mixed',
    });
    if (!parsed.success) {
      throw this.invalidQuery();
    }
    return parsed.data;
  }

  private parseOverviewQuery(searchParams: URLSearchParams): {
    from?: string;
    to?: string;
  } {
    for (const key of new Set(searchParams.keys())) {
      if (
        !allowedOverviewQueryParameters.has(key) ||
        searchParams.getAll(key).length !== 1
      ) {
        throw this.invalidQuery();
      }
    }
    const parsed = analyticsOverviewQuerySchema.safeParse({
      ...(searchParams.has('from') ? { from: searchParams.get('from') } : {}),
      ...(searchParams.has('to') ? { to: searchParams.get('to') } : {}),
    });
    if (!parsed.success) {
      throw this.invalidQuery();
    }
    return parsed.data;
  }

  private parseFunnelQuery(searchParams: URLSearchParams) {
    for (const key of new Set(searchParams.keys())) {
      if (
        !allowedFunnelQueryParameters.has(key) ||
        searchParams.getAll(key).length !== 1
      ) {
        throw this.invalidQuery();
      }
    }
    const parsed = funnelAggregationFiltersSchema.safeParse({
      ...(searchParams.has('from') ? { from: searchParams.get('from') } : {}),
      ...(searchParams.has('to') ? { to: searchParams.get('to') } : {}),
      ...(searchParams.has('locale')
        ? { locale: searchParams.get('locale') }
        : {}),
    });
    if (!parsed.success) {
      throw this.invalidQuery();
    }
    return parsed.data;
  }

  private requireEmptyQuery(searchParams: URLSearchParams): void {
    if (searchParams.size !== 0) {
      throw this.invalidQuery();
    }
  }

  private parseOptionalBoolean(value: string | null): boolean | undefined {
    if (value === null) {
      return undefined;
    }
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
    throw this.invalidQuery();
  }

  private parseLimit(value: string | null): number {
    if (value === null) {
      return defaultPageSize;
    }
    if (!/^[1-9]\d*$/.test(value)) {
      throw this.invalidQuery();
    }
    const limit = Number(value);
    if (!Number.isSafeInteger(limit) || limit > maximumPageSize) {
      throw this.invalidQuery();
    }
    return limit;
  }

  private parsePositiveInteger(value: string): number {
    if (!/^[1-9]\d*$/.test(value)) {
      throw this.invalidQuery();
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw this.invalidQuery();
    }
    return parsed;
  }

  private encodeCursor(offset: number): string {
    return Buffer.from(String(offset), 'utf8').toString('base64url');
  }

  private decodeCursor(value: string | null): number {
    if (value === null) {
      return 0;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw this.invalidQuery();
    }
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    if (!/^(0|[1-9]\d*)$/.test(decoded)) {
      throw this.invalidQuery();
    }
    const offset = Number(decoded);
    if (!Number.isSafeInteger(offset) || this.encodeCursor(offset) !== value) {
      throw this.invalidQuery();
    }
    return offset;
  }

  private decodeSessionId(value: string): string {
    return this.decodePathSegment(value);
  }

  private decodePathSegment(value: string): string {
    try {
      const decoded = decodeURIComponent(value);
      if (!decoded) {
        throw this.invalidQuery();
      }
      return decoded;
    } catch (cause) {
      if (cause instanceof AnalyticsQueryHttpError) {
        throw cause;
      }
      throw this.invalidQuery();
    }
  }

  private invalidQuery(): AnalyticsQueryHttpError {
    return new AnalyticsQueryHttpError(
      400,
      'INVALID_ANALYTICS_QUERY',
      'Analytics query is invalid.',
    );
  }
}

class AnalyticsQueryHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AnalyticsQueryHttpError';
  }
}
