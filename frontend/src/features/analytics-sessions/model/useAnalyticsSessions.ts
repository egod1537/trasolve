import { useCallback } from 'react';
import type { AnalyticsEvent, AnalyticsSessionSummary } from '@trasolve/shared';
import {
  getAnalyticsSessionEvents,
  getAnalyticsSessions,
} from '@/shared/api/analytics';
import {
  usePaginatedAnalytics,
  type PaginatedAnalyticsState,
} from './usePaginatedAnalytics';

export type AnalyticsSessionPeriod = {
  from?: string;
  to?: string;
};

export function useAnalyticsSessionList(period: AnalyticsSessionPeriod): {
  state: PaginatedAnalyticsState<AnalyticsSessionSummary>;
  reload: () => void;
  loadMore: () => void;
} {
  const { from, to } = period;
  const loadPage = useCallback(
    async (cursor: string | undefined, signal: AbortSignal) => {
      const page = await getAnalyticsSessions(
        { from, to, limit: 50, ...(cursor ? { cursor } : {}) },
        { signal },
      );
      return { items: page.sessions, nextCursor: page.nextCursor };
    },
    [from, to],
  );
  return usePaginatedAnalytics({ queryKey: `${from}|${to}`, loadPage });
}

export function useAnalyticsSessionEvents(
  sessionId: string | null,
  period: AnalyticsSessionPeriod,
): {
  state: PaginatedAnalyticsState<AnalyticsEvent>;
  reload: () => void;
  loadMore: () => void;
} {
  const { from, to } = period;
  const loadPage = useCallback(
    async (cursor: string | undefined, signal: AbortSignal) => {
      if (sessionId === null) {
        return { items: [], nextCursor: null };
      }
      const page = await getAnalyticsSessionEvents(
        sessionId,
        { from, to, limit: 100, ...(cursor ? { cursor } : {}) },
        { signal },
      );
      return { items: page.events, nextCursor: page.nextCursor };
    },
    [from, sessionId, to],
  );
  return usePaginatedAnalytics({
    queryKey: `${sessionId ?? ''}|${from}|${to}`,
    loadPage,
  });
}
