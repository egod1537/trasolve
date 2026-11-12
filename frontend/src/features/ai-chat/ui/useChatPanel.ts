import type { Props } from './chatPanelTypes';
import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useState,
  type ForwardedRef,
} from 'react';
import { getLanguage, useL, type Localize } from '@/shared/i18n';
import { useChatThreads } from '../model/useChatThreads';
import { useThreadRequests } from '../model/useThreadRequests';
import type { MapAiPanelHandle, ChatThread } from '../model/chatTypes';
import { getThreadTitle, getUnreadPreviews } from './chatPresentation';
import { useChatThreadControls } from './useChatThreadControls';
import { useChatPanelEffects } from './useChatPanelEffects';

/** Composes shared chat state with panel-only navigation and DOM effects. */
export function useChatPanel(
  props: Pick<
    Props,
    'open' | 'persistenceKey' | 'onGeneratingChange' | 'onUnreadPreviewsChange'
  >,
  ref: ForwardedRef<MapAiPanelHandle>,
  { autoScroll = true }: { autoScroll?: boolean } = {},
) {
  const { open, onGeneratingChange, onUnreadPreviewsChange } = props;
  const L = useL();
  const titleId = useId();
  const state = useChatThreads(props);
  const requests = useThreadRequests(state.getSelectedThreadId);
  const controls = useChatThreadControls(
    state,
    requests.cancelThreadRequest,
    L,
  );
  const { threads, selectedThreadId, selectedThreadIdRef, markThreadRead } =
    state;
  const list = useChatThreadList(threads, selectedThreadId, L);
  const { selectedThread } = list;
  const selectedThreadSending = requests.sendingThreadIds.has(
    selectedThread.id,
  );
  const generating = requests.sendingThreadIds.size > 0;
  const unreadPreviews = useMemo(
    () => getUnreadPreviews(threads, L),
    [L, threads],
  );
  const effects = useChatPanelEffects({
    open,
    selectedThreadId,
    activeThreadId: selectedThread.id,
    messageCount: selectedThread.messages.length,
    messageError: selectedThread.error,
    selectedThreadSending,
    openMenuThreadId: controls.openMenuThreadId,
    setOpenMenuThreadId: controls.setOpenMenuThreadId,
    autoScroll,
  });
  useEffect(() => {
    onGeneratingChange?.(generating);
    return () => onGeneratingChange?.(false);
  }, [generating, onGeneratingChange]);
  useEffect(() => {
    onUnreadPreviewsChange?.(unreadPreviews);
  }, [onUnreadPreviewsChange, unreadPreviews]);
  const { selectThread } = controls;
  useImperativeHandle(
    ref,
    () => ({
      viewSelectedThread: () => markThreadRead(selectedThreadIdRef.current),
      viewThread: selectThread,
    }),
    [markThreadRead, selectedThreadIdRef, selectThread],
  );
  return {
    ...state,
    ...requests,
    ...controls,
    ...effects,
    L,
    titleId,
    ...list,
    selectedThreadSending,
    draft: state.drafts[selectedThread.id] ?? '',
  };
}

function useChatThreadList(
  threads: ChatThread[],
  selectedThreadId: string,
  L: Localize,
) {
  const [searchQuery, setSearchQuery] = useState('');
  const selectedThread = useMemo(
    () =>
      threads.find((thread) => thread.id === selectedThreadId) ?? threads[0]!,
    [selectedThreadId, threads],
  );
  const visibleThreads = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase(getLanguage());
    return threads
      .filter(
        (thread) =>
          !query ||
          getThreadTitle(thread, L)
            .toLocaleLowerCase(getLanguage())
            .includes(query),
      )
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [L, searchQuery, threads]);
  const [recentThreads, archivedThreads] = useMemo(
    () => [
      visibleThreads.filter((thread) => !thread.archived),
      visibleThreads.filter((thread) => thread.archived),
    ],
    [visibleThreads],
  );
  return {
    searchQuery,
    setSearchQuery,
    selectedThread,
    recentThreads,
    archivedThreads,
  };
}
