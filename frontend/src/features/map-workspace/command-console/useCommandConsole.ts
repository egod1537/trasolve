import { commandFingerprint } from './commandFingerprint';
import { NL } from '@/shared/i18n';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import {
  workspaceCommandDefinitions,
  type WorkspaceCommandRequest,
} from '@trasolve/shared';
import { useTripData } from '../hooks/useTrip';
import { useCommandRuntime } from './CommandProvider';
import { parseWorkspaceCommand } from './parseCommand';
import { completeCommand } from './commandCompletion';
export function useCommandConsole({
  open,
  onOpen,
  onClose,
  inputRef,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const runtime = useCommandRuntime();
  const trip = useTripData();
  const records = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const candidates = useMemo(() => completeCommand(query, trip), [query, trip]);
  const definition = [...workspaceCommandDefinitions]
    .sort((a, b) => b.name.length - a.name.length)
    .find(
      (d) =>
        query.trimStart() === d.name ||
        query.trimStart().startsWith(`${d.name} `),
    );
  const busy = records.some((record) => record.status === 'running');
  const run = useCallback(
    async (request: WorkspaceCommandRequest, expectedTrip?: string) => {
      if (expectedTrip && expectedTrip !== commandFingerprint(trip)) {
        setError(NL('STALE_CONTEXT'));
        return;
      }
      setError(null);
      if (
        [
          'capture',
          'export',
          'import',
          'settings',
          'trip open',
          'trip new',
          'trip delete',
          'tool',
        ].includes(request.name)
      ) {
        onClose();
      }
      try {
        const result = await runtime.execute(request);
        if (result.handoff) {
          onClose();
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : NL('COMMAND_FAILED'));
      }
    },
    [onClose, runtime, trip],
  );
  const submit = () => {
    try {
      const request = parseWorkspaceCommand(query);
      setHistory((h) => [query, ...h.filter((s) => s !== query)].slice(0, 30));
      setHistoryIndex(-1);
      void run(request);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : NL('INVALID_COMMAND'));
    }
  };
  const change = (value: string) => {
    setQuery(value);
    setSelected(0);
    setError(null);
    setHistoryIndex(-1);
  };
  const recall = (direction: number) => {
    const index = Math.max(
      0,
      Math.min(history.length - 1, historyIndex + direction),
    );
    const value = history[index];
    if (value !== undefined) {
      setHistoryIndex(index);
      setQuery(value);
      setError(null);
      setSelected(0);
    }
  };
  const complete = () => {
    const candidate = candidates[selected];
    if (candidate) {
      change(candidate.value);
      inputRef.current?.focus();
    }
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.isComposing) {
        return;
      }
      if (
        event.key.toLowerCase() === 'k' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey
      ) {
        event.preventDefault();
        if (open) {
          inputRef.current?.focus();
        } else {
          onOpen();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputRef, onOpen, open]);
  return {
    runtime,
    records,
    query,
    change,
    selected,
    setSelected,
    error,
    recall,
    candidates,
    definition,
    busy,
    run,
    submit,
    complete,
  };
}
