import {
  API_ROUTES,
  buildAnalyticsFunnelApiRoute,
  buildAnalyticsSessionEventsRoute,
  analyticsEventPageSchema,
  analyticsFunnelListResponseSchema,
  analyticsFunnelResultResponseSchema,
  analyticsFlowResponseSchema,
  analyticsOverviewResponseSchema,
  analyticsSessionPageSchema,
  type AnalyticsEventPage,
  type AnalyticsEventRequest,
  type AnalyticsEventType,
  type AnalyticsFunnelListResponse,
  type AnalyticsFunnelResultResponse,
  type AnalyticsFlowNodeMode,
  type AnalyticsFlowResponse,
  type AnalyticsOverviewResponse,
  type AnalyticsLocale,
  type AnalyticsScreen,
  type AnalyticsSessionPage,
} from '@trasolve/shared';

export type { AnalyticsEventRequest } from '@trasolve/shared';

export type AnalyticsFlowQuery = {
  from?: string;
  to?: string;
  screen?: AnalyticsScreen;
  eventType?: AnalyticsEventType;
  minimumCount?: number;
  nodeMode?: AnalyticsFlowNodeMode;
};

export type AnalyticsOverviewQuery = {
  from?: string;
  to?: string;
};

export type AnalyticsFunnelQuery = {
  from?: string;
  to?: string;
  locale?: AnalyticsLocale;
};

export type AnalyticsSessionsQuery = {
  from?: string;
  to?: string;
  eventType?: AnalyticsEventType;
  screen?: AnalyticsScreen;
  userId?: string;
  anonymous?: boolean;
  limit?: number;
  cursor?: string;
};

type AnalyticsRequestOptions = {
  signal?: AbortSignal;
};

export async function sendAnalyticsEvent(
  request: AnalyticsEventRequest,
): Promise<void> {
  await fetch(API_ROUTES.analyticsEvents, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    keepalive: true,
  });
}

export async function getAnalyticsFlow(
  query: AnalyticsFlowQuery = {},
  options: { signal?: AbortSignal } = {},
): Promise<AnalyticsFlowResponse> {
  const search = new URLSearchParams();
  if (query.from !== undefined) {
    search.set('from', query.from);
  }
  if (query.to !== undefined) {
    search.set('to', query.to);
  }
  if (query.screen !== undefined) {
    search.set('screen', query.screen);
  }
  if (query.eventType !== undefined) {
    search.set('eventType', query.eventType);
  }
  if (query.minimumCount !== undefined) {
    search.set('minimumCount', String(query.minimumCount));
  }
  if (query.nodeMode !== undefined) {
    search.set('nodeMode', query.nodeMode);
  }

  const suffix = search.size === 0 ? '' : `?${search.toString()}`;
  const response = await fetch(`${API_ROUTES.analyticsFlows}${suffix}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`Analytics flow request failed with ${response.status}.`);
  }
  return analyticsFlowResponseSchema.parse(await response.json());
}

export async function getAnalyticsOverview(
  query: AnalyticsOverviewQuery = {},
  options: AnalyticsRequestOptions = {},
): Promise<AnalyticsOverviewResponse> {
  const search = new URLSearchParams();
  if (query.from !== undefined) {
    search.set('from', query.from);
  }
  if (query.to !== undefined) {
    search.set('to', query.to);
  }

  const suffix = search.size === 0 ? '' : `?${search.toString()}`;
  const response = await fetch(`${API_ROUTES.analyticsOverview}${suffix}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(
      `Analytics overview request failed with ${response.status}.`,
    );
  }
  return analyticsOverviewResponseSchema.parse(await response.json());
}

export async function getAnalyticsFunnels(
  options: AnalyticsRequestOptions = {},
): Promise<AnalyticsFunnelListResponse> {
  const response = await fetch(API_ROUTES.analyticsFunnels, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(
      `Analytics funnel list request failed with ${response.status}.`,
    );
  }
  return analyticsFunnelListResponseSchema.parse(await response.json());
}

export async function getAnalyticsFunnel(
  funnelId: string,
  query: AnalyticsFunnelQuery = {},
  options: AnalyticsRequestOptions = {},
): Promise<AnalyticsFunnelResultResponse> {
  const search = new URLSearchParams();
  if (query.from !== undefined) {
    search.set('from', query.from);
  }
  if (query.to !== undefined) {
    search.set('to', query.to);
  }
  if (query.locale !== undefined) {
    search.set('locale', query.locale);
  }
  const suffix = search.size === 0 ? '' : `?${search.toString()}`;
  const response = await fetch(
    `${buildAnalyticsFunnelApiRoute(funnelId)}${suffix}`,
    { signal: options.signal },
  );
  if (!response.ok) {
    throw new Error(`Analytics funnel request failed with ${response.status}.`);
  }
  return analyticsFunnelResultResponseSchema.parse(await response.json());
}

export async function getAnalyticsSessions(
  query: AnalyticsSessionsQuery = {},
  options: AnalyticsRequestOptions = {},
): Promise<AnalyticsSessionPage> {
  return requestAnalyticsPage(
    API_ROUTES.analyticsSessions,
    query,
    analyticsSessionPageSchema,
    options,
  );
}

export async function getAnalyticsSessionEvents(
  sessionId: string,
  query: AnalyticsSessionsQuery = {},
  options: AnalyticsRequestOptions = {},
): Promise<AnalyticsEventPage> {
  return requestAnalyticsPage(
    buildAnalyticsSessionEventsRoute(sessionId),
    query,
    analyticsEventPageSchema,
    options,
  );
}

async function requestAnalyticsPage<Result>(
  route: string,
  query: AnalyticsSessionsQuery,
  schema: { parse(value: unknown): Result },
  options: AnalyticsRequestOptions,
): Promise<Result> {
  const search = new URLSearchParams();
  if (query.from !== undefined) {
    search.set('from', query.from);
  }
  if (query.to !== undefined) {
    search.set('to', query.to);
  }
  if (query.eventType !== undefined) {
    search.set('eventType', query.eventType);
  }
  if (query.screen !== undefined) {
    search.set('screen', query.screen);
  }
  if (query.userId !== undefined) {
    search.set('userId', query.userId);
  }
  if (query.anonymous !== undefined) {
    search.set('anonymous', String(query.anonymous));
  }
  if (query.limit !== undefined) {
    search.set('limit', String(query.limit));
  }
  if (query.cursor !== undefined) {
    search.set('cursor', query.cursor);
  }

  const suffix = search.size === 0 ? '' : `?${search.toString()}`;
  const response = await fetch(`${route}${suffix}`, {
    signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(`Analytics query request failed with ${response.status}.`);
  }
  return schema.parse(await response.json());
}
