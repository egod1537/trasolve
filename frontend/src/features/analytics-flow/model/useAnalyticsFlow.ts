import { useCallback, useEffect, useState } from 'react';
import type { AnalyticsFlowResponse } from '@trasolve/shared';
import {
  getAnalyticsFlow,
  type AnalyticsFlowQuery,
} from '@/shared/api/analytics';

export type AnalyticsFlowLoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: AnalyticsFlowResponse }
  | { status: 'error' };

const loadingState: AnalyticsFlowLoadState = { status: 'loading' };

type KeyedLoadState = {
  requestKey: string;
  state: AnalyticsFlowLoadState;
};

export function useAnalyticsFlow(query: AnalyticsFlowQuery): {
  state: AnalyticsFlowLoadState;
  reload: () => void;
} {
  const [requestVersion, setRequestVersion] = useState(0);
  const [loaded, setLoaded] = useState<KeyedLoadState>({
    requestKey: '',
    state: loadingState,
  });
  const { eventType, from, minimumCount, nodeMode, screen, to } = query;
  const requestKey = [
    from,
    to,
    screen,
    eventType,
    minimumCount,
    nodeMode,
    requestVersion,
  ].join('|');

  const reload = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getAnalyticsFlow(
      { eventType, from, minimumCount, nodeMode, screen, to },
      { signal: controller.signal },
    )
      .then((data) => {
        setLoaded({ requestKey, state: { status: 'ready', data } });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        setLoaded({ requestKey, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [eventType, from, minimumCount, nodeMode, requestKey, screen, to]);

  return {
    state: loaded.requestKey === requestKey ? loaded.state : loadingState,
    reload,
  };
}
