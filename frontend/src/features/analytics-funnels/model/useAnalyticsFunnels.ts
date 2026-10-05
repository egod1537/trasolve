import { useCallback, useEffect, useState } from 'react';
import type {
  AnalyticsFunnelListResponse,
  AnalyticsFunnelResultResponse,
  AnalyticsLocale,
} from '@trasolve/shared';
import {
  getAnalyticsFunnel,
  getAnalyticsFunnels,
} from '@/shared/api/analytics';

export type AnalyticsFunnelListState =
  | { status: 'loading' }
  | { status: 'ready'; data: AnalyticsFunnelListResponse }
  | { status: 'error' };

export type AnalyticsFunnelResultState =
  | { status: 'loading' }
  | { status: 'ready'; data: AnalyticsFunnelResultResponse }
  | { status: 'error' };

const loadingListState: AnalyticsFunnelListState = { status: 'loading' };
const loadingResultState: AnalyticsFunnelResultState = { status: 'loading' };

export function useAnalyticsFunnelList(): {
  state: AnalyticsFunnelListState;
  reload: () => void;
} {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{
    version: number;
    state: AnalyticsFunnelListState;
  }>({ version: -1, state: loadingListState });
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void getAnalyticsFunnels({ signal: controller.signal })
      .then((data) => setLoaded({ version, state: { status: 'ready', data } }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        setLoaded({ version, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [version]);

  return {
    state: loaded.version === version ? loaded.state : loadingListState,
    reload,
  };
}

export function useAnalyticsFunnelResult(
  funnelId: string,
  period: { from?: string; to?: string },
  locale: AnalyticsLocale,
): { state: AnalyticsFunnelResultState; reload: () => void } {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    state: AnalyticsFunnelResultState;
  }>({ key: '', state: loadingResultState });
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const { from, to } = period;
  const key = `${funnelId}|${from ?? ''}|${to ?? ''}|${locale}|${version}`;

  useEffect(() => {
    const controller = new AbortController();
    void getAnalyticsFunnel(
      funnelId,
      { from, to, locale },
      { signal: controller.signal },
    )
      .then((data) => setLoaded({ key, state: { status: 'ready', data } }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        setLoaded({ key, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [from, funnelId, key, locale, to]);

  return {
    state: loaded.key === key ? loaded.state : loadingResultState,
    reload,
  };
}
