export type AnalyticsSessionsExplorerLabels = {
  filters: string;
  from: string;
  to: string;
  timezone: string;
  applyFilters: string;
  sessions: string;
  timeline: string;
  loading: string;
  error: string;
  retry: string;
  emptySessions: string;
  selectSession: string;
  loadMore: string;
  loadingMore: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  eventCount: string;
  user: string;
  authenticated: string;
  anonymous: string;
  mixedIdentity: string;
  pathLength: string;
  timestamp: string;
  eventType: string;
  screen: string;
  target: string;
  noTarget: string;
  metadata: string;
  noMetadata: string;
  metadataDetails: string;
};

export type LocalPeriod = {
  from: string;
  to: string;
};
