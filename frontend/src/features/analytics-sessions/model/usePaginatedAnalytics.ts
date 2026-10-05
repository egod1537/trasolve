import { useCallback, useEffect, useRef, useState } from 'react';

export type PaginatedAnalyticsState<Item> =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready';
      items: readonly Item[];
      nextCursor: string | null;
      loadMoreStatus: 'idle' | 'loading' | 'error';
    };

type Page<Item> = {
  items: readonly Item[];
  nextCursor: string | null;
};

type KeyedState<Item> = {
  requestKey: string;
  state: PaginatedAnalyticsState<Item>;
};

export function usePaginatedAnalytics<Item>({
  queryKey,
  loadPage,
}: {
  queryKey: string;
  loadPage: (
    cursor: string | undefined,
    signal: AbortSignal,
  ) => Promise<Page<Item>>;
}): {
  state: PaginatedAnalyticsState<Item>;
  reload: () => void;
  loadMore: () => void;
} {
  const [requestVersion, setRequestVersion] = useState(0);
  const requestKey = `${queryKey}|${requestVersion}`;
  const [loaded, setLoaded] = useState<KeyedState<Item>>({
    requestKey: '',
    state: { status: 'loading' },
  });
  const moreRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadPage(undefined, controller.signal)
      .then((page) => {
        setLoaded({
          requestKey,
          state: {
            status: 'ready',
            items: page.items,
            nextCursor: page.nextCursor,
            loadMoreStatus: 'idle',
          },
        });
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) {
          return;
        }
        setLoaded({ requestKey, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [loadPage, requestKey]);

  useEffect(
    () => () => {
      moreRequestRef.current?.abort();
    },
    [],
  );

  const reload = useCallback(() => {
    moreRequestRef.current?.abort();
    setRequestVersion((version) => version + 1);
  }, []);

  const loadMore = useCallback(() => {
    if (
      loaded.requestKey !== requestKey ||
      loaded.state.status !== 'ready' ||
      loaded.state.nextCursor === null ||
      loaded.state.loadMoreStatus === 'loading' ||
      moreRequestRef.current !== null
    ) {
      return;
    }
    const cursor = loaded.state.nextCursor;
    const controller = new AbortController();
    moreRequestRef.current = controller;
    setLoaded((current) =>
      current.requestKey === requestKey && current.state.status === 'ready'
        ? {
            requestKey,
            state: { ...current.state, loadMoreStatus: 'loading' },
          }
        : current,
    );
    void loadPage(cursor, controller.signal)
      .then((page) => {
        setLoaded((current) =>
          current.requestKey === requestKey && current.state.status === 'ready'
            ? {
                requestKey,
                state: {
                  status: 'ready',
                  items: [...current.state.items, ...page.items],
                  nextCursor: page.nextCursor,
                  loadMoreStatus: 'idle',
                },
              }
            : current,
        );
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) {
          return;
        }
        setLoaded((current) =>
          current.requestKey === requestKey && current.state.status === 'ready'
            ? {
                requestKey,
                state: { ...current.state, loadMoreStatus: 'error' },
              }
            : current,
        );
      })
      .finally(() => {
        if (moreRequestRef.current === controller) {
          moreRequestRef.current = null;
        }
      });
  }, [loadPage, loaded, requestKey]);

  return {
    state:
      loaded.requestKey === requestKey ? loaded.state : { status: 'loading' },
    reload,
    loadMore,
  };
}

function isAbortError(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}
