import { useCallback, useEffect, useState } from 'react';

/** Ignore superseded responses; never show data from a different filter or entity. */
export function useAdminResource<T>(load: () => Promise<T>) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    source: () => Promise<T>;
    revision: number;
    data?: T;
    error?: unknown;
  }>({ source: load, revision: -1 });
  useEffect(() => {
    let active = true;
    void load().then(
      (data) => {
        if (active) {
          setState({ source: load, revision, data });
        }
      },
      (error) => {
        if (active) {
          setState({ source: load, revision, error });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [load, revision]);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const loading = state.source !== load || state.revision !== revision;
  return {
    data: loading ? undefined : state.data,
    error: loading ? undefined : state.error,
    loading,
    reload,
  };
}

export function useAdminPagination() {
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  return {
    cursor: cursors[cursors.length - 1],
    page: cursors.length,
    previous: () =>
      setCursors((values) =>
        values.length > 1 ? values.slice(0, -1) : values,
      ),
    next: (cursor: string | null | undefined) => {
      if (cursor) {
        setCursors((values) => [...values, cursor]);
      }
    },
    reset: () => setCursors([null]),
  };
}
