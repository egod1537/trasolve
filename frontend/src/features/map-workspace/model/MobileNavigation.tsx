import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type MobileMapTab = 'map' | 'layers' | 'ai';
export type MobileSheetSize = 'collapsed' | 'half' | 'full';
type Navigation = {
  tab: MobileMapTab;
  revision: number;
  sheetSize: MobileSheetSize;
  setSheetSize: Dispatch<SetStateAction<MobileSheetSize>>;
  navigate: (tab: MobileMapTab) => void;
};
const Context = createContext<Navigation | null>(null);

export function MobileNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, setState] = useState({
    tab: 'map' as MobileMapTab,
    revision: 0,
    sheetSize: 'half' as MobileSheetSize,
  });
  const navigate = useCallback((tab: MobileMapTab) => {
    setState((current) => ({
      ...current,
      tab,
      revision: current.revision + 1,
      sheetSize:
        tab === 'layers' && current.sheetSize === 'collapsed'
          ? 'half'
          : current.sheetSize,
    }));
  }, []);
  const setSheetSize = useCallback<Dispatch<SetStateAction<MobileSheetSize>>>(
    (update) => {
      setState((current) => ({
        ...current,
        sheetSize:
          typeof update === 'function' ? update(current.sheetSize) : update,
      }));
    },
    [],
  );
  const value = useMemo(
    () => ({ ...state, navigate, setSheetSize }),
    [state, navigate, setSheetSize],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMobileNavigation() {
  return useContext(Context);
}

/** Version transient selection with navigation; pane changes do not need an effect. */
export function useMobileDetailSelection<T>() {
  const revision = useMobileNavigation()?.revision ?? 0;
  const [selection, setSelection] = useState<{
    revision: number;
    value: T | null;
  }>({ revision, value: null });
  const value = selection.revision === revision ? selection.value : null;
  const update = useCallback<Dispatch<SetStateAction<T | null>>>(
    (action) => {
      setSelection((current) => {
        const previous = current.revision === revision ? current.value : null;
        return {
          revision,
          value:
            typeof action === 'function'
              ? (action as (value: T | null) => T | null)(previous)
              : action,
        };
      });
    },
    [revision],
  );
  return [value, update] as const;
}
