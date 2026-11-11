import { useChatPersistence } from './useChatPersistence';
import { useChatPanelEffects } from '../ui/useChatPanelEffects';
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useThreadRequests } from '@/features/ai-chat/ui/useThreadRequests';

import { getLanguage, useL } from '@/shared/i18n';

import {
  type Props,
  type UiChatMessage,
  type MapAiPanelHandle,
  type ChatThread,
} from '@/features/ai-chat/model/chatTypes';
import {
  readProductChat,
  nextMessageId,
} from '@/features/ai-chat/model/chatPersistence';
import {
  createThread,
  getUnreadPreviews,
  markAssistantMessagesRead,
  assertThreadMessageRefInvariant,
} from '@/features/ai-chat/model/chatThreads';
import { getThreadTitle } from '@/features/ai-chat/ui/chatPresentation';

const EMPTY_MESSAGES: readonly UiChatMessage[] = [];

export function useChatThreads(
  {
    open,
    persistenceKey,
    onGeneratingChange,
    onUnreadPreviewsChange,
  }: Pick<
    Props,
    'open' | 'persistenceKey' | 'onGeneratingChange' | 'onUnreadPreviewsChange'
  >,
  ref: import('react').ForwardedRef<MapAiPanelHandle>,
  { autoScroll = true }: { autoScroll?: boolean } = {},
) {
  const L = useL();
  const titleId = useId();
  const [initialProductChat] = useState(() => readProductChat(persistenceKey));
  const [threads, setThreads] = useState<ChatThread[]>(() => [
    {
      ...createThread('chat-1'),
      messages: initialProductChat?.messages ?? [],
    },
  ]);
  const threadMessagesRef = useRef<Map<string, UiChatMessage[]>>(
    new Map([['chat-1', threads[0]!.messages]]),
  );
  const threadsRef = useRef(threads);
  const threadIdsRef = useRef(new Set(['chat-1']));
  const [selectedThreadId, setSelectedThreadId] = useState('chat-1');
  const [drafts, setDrafts] = useState<Record<string, string>>(
    (): Record<string, string> =>
      initialProductChat ? { 'chat-1': initialProductChat.draft } : {},
  );
  const draftsRef = useRef<Record<string, string>>(drafts);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(null);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [listDrawerOpen, setListDrawerOpen] = useState(false);
  const nextThreadIdRef = useRef(2);
  const nextMessageIdRef = useRef(
    nextMessageId(initialProductChat?.messages ?? []),
  );
  const openRef = useRef(open);
  const selectedThreadIdRef = useRef(selectedThreadId);
  const getSelectedThreadId = useCallback(
    () => selectedThreadIdRef.current,
    [],
  );
  const {
    sendingThreadIds,
    isThreadSending,
    beginRequest,
    finishRequest,
    setDebugDelayPending,
    cancelThreadRequest,
  } = useThreadRequests(getSelectedThreadId);
  const selectedThread = useMemo(
    () =>
      threads.find((thread) => thread.id === selectedThreadId) ?? threads[0]!,
    [selectedThreadId, threads],
  );
  const draft = drafts[selectedThread.id] ?? '';
  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLocaleLowerCase(getLanguage()),
    [searchQuery],
  );
  const visibleThreads = useMemo(
    () =>
      threads
        .filter(
          (thread) =>
            !normalizedQuery ||
            getThreadTitle(thread, L)
              .toLocaleLowerCase(getLanguage())
              .includes(normalizedQuery),
        )
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [L, normalizedQuery, threads],
  );
  const [recentThreads, archivedThreads] = useMemo(
    () => [
      visibleThreads.filter((thread) => !thread.archived),
      visibleThreads.filter((thread) => thread.archived),
    ],
    [visibleThreads],
  );
  const selectedThreadSending = sendingThreadIds.has(selectedThread.id);
  const generating = sendingThreadIds.size > 0;
  const unreadPreviews = useMemo(
    () => getUnreadPreviews(threads, L),
    [L, threads],
  );

  const { textareaRef, messagesRef } = useChatPanelEffects({
    open,
    selectedThreadId,
    activeThreadId: selectedThread.id,
    messageCount: selectedThread.messages.length,
    messageError: selectedThread.error,
    selectedThreadSending,
    openMenuThreadId,
    setOpenMenuThreadId,
    autoScroll,
  });
  useLayoutEffect(() => {
    openRef.current = open;
    selectedThreadIdRef.current = selectedThreadId;
  }, [open, selectedThreadId]);

  useLayoutEffect(() => {
    threadsRef.current = threads;
    threadIdsRef.current = new Set(threads.map((thread) => thread.id));
    assertThreadMessageRefInvariant(threads, threadMessagesRef.current);
  }, [threads]);

  useEffect(() => {
    onGeneratingChange?.(generating);
    return () => onGeneratingChange?.(false);
  }, [generating, onGeneratingChange]);

  useEffect(() => {
    onUnreadPreviewsChange?.(unreadPreviews);
  }, [onUnreadPreviewsChange, unreadPreviews]);

  useChatPersistence(
    persistenceKey,
    threads[0]?.messages ?? EMPTY_MESSAGES,
    drafts['chat-1'] ?? '',
  );

  const changeSelectedThread = useCallback((threadId: string) => {
    selectedThreadIdRef.current = threadId;
    setSelectedThreadId(threadId);
  }, []);

  const markThreadRead = useCallback((threadId: string) => {
    const messageSnapshot = threadMessagesRef.current.get(threadId);
    if (!messageSnapshot) {
      return;
    }
    const nextMessages = markAssistantMessagesRead(messageSnapshot);
    threadMessagesRef.current.set(threadId, nextMessages);
    setThreads((current) => {
      const next = current.map((thread) => {
        if (thread.id !== threadId) {
          return thread;
        }
        return nextMessages === thread.messages
          ? thread
          : { ...thread, messages: nextMessages };
      });
      return next.some((thread, index) => thread !== current[index])
        ? next
        : current;
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      viewSelectedThread: () => {
        markThreadRead(selectedThreadIdRef.current);
      },
      viewThread: (threadId) => {
        changeSelectedThread(threadId);
        setOpenMenuThreadId(null);
        setRenamingThreadId(null);
        setListDrawerOpen(false);
        markThreadRead(threadId);
      },
    }),
    [changeSelectedThread, markThreadRead],
  );

  const createNewThread = () => {
    const thread = createThread(`chat-${nextThreadIdRef.current++}`);
    threadMessagesRef.current.set(thread.id, thread.messages);
    threadIdsRef.current.add(thread.id);
    setThreads((current) => [thread, ...current]);
    changeSelectedThread(thread.id);
    setOpenMenuThreadId(null);
    setRenamingThreadId(null);
    setListDrawerOpen(false);
  };

  const selectThread = (threadId: string) => {
    changeSelectedThread(threadId);
    markThreadRead(threadId);
    setOpenMenuThreadId(null);
    setRenamingThreadId(null);
    setListDrawerOpen(false);
  };

  const beginRename = (thread: ChatThread) => {
    setRenamingThreadId(thread.id);
    setRenameDraft(getThreadTitle(thread, L));
    setOpenMenuThreadId(null);
  };

  const commitRename = (threadId: string) => {
    const title = renameDraft.trim();
    if (!title) {
      return;
    }
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              title,
              titleIsDefault: false,
              updatedAt: Date.now(),
            }
          : thread,
      ),
    );
    setRenamingThreadId(null);
    setRenameDraft('');
  };

  const setArchived = (threadId: string, archived: boolean) => {
    let replacement: ChatThread | null = null;
    if (archived && selectedThreadIdRef.current === threadId) {
      const fallback = threads.find(
        (thread) => thread.id !== threadId && !thread.archived,
      );
      if (fallback) {
        changeSelectedThread(fallback.id);
      } else {
        replacement = createThread(`chat-${nextThreadIdRef.current++}`);
        threadMessagesRef.current.set(replacement.id, replacement.messages);
        threadIdsRef.current.add(replacement.id);
        changeSelectedThread(replacement.id);
      }
    }
    setThreads((current) => {
      const next = current.map((thread) =>
        thread.id === threadId
          ? { ...thread, archived, updatedAt: Date.now() }
          : thread,
      );
      return replacement ? [replacement, ...next] : next;
    });
    setOpenMenuThreadId(null);
  };

  const deleteThread = (threadId: string) => {
    cancelThreadRequest(threadId, 'thread-deleted');
    threadMessagesRef.current.delete(threadId);
    threadIdsRef.current.delete(threadId);
    const remainingThreads = threads.filter((thread) => thread.id !== threadId);
    const replacement = remainingThreads.length
      ? null
      : createThread(`chat-${nextThreadIdRef.current++}`);
    if (replacement) {
      threadMessagesRef.current.set(replacement.id, replacement.messages);
      threadIdsRef.current.add(replacement.id);
    }
    if (selectedThreadIdRef.current === threadId) {
      changeSelectedThread(
        remainingThreads.find((thread) => !thread.archived)?.id ??
          remainingThreads[0]?.id ??
          replacement!.id,
      );
    }
    setThreads((current) => {
      const next = current.filter((thread) => thread.id !== threadId);
      return next.length ? next : [replacement!];
    });
    const nextDrafts = { ...draftsRef.current };
    delete nextDrafts[threadId];
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    setOpenMenuThreadId(null);
    setRenamingThreadId(null);
  };

  const changeDraft = useCallback((value: string) => {
    const threadId = selectedThreadIdRef.current;
    draftsRef.current = { ...draftsRef.current, [threadId]: value };
    setDrafts(draftsRef.current);
  }, []);
  const cancelRename = () => {
    setRenamingThreadId(null);
    setRenameDraft('');
  };
  const toggleThreadMenu = (id: string) =>
    setOpenMenuThreadId((current) => (current === id ? null : id));
  const cancelCreation = (id: string) => {
    cancelThreadRequest(id, 'explicit-cancel');
    setOpenMenuThreadId(null);
  };
  return {
    changeDraft,
    cancelRename,
    toggleThreadMenu,
    cancelCreation,
    searchQuery,
    setSearchQuery,
    selectedThreadSending,
    L,
    titleId,
    threads,
    setThreads,
    threadMessagesRef,
    threadsRef,
    threadIdsRef,
    selectedThreadIdRef,
    draftsRef,
    setDrafts,
    nextMessageIdRef,
    openRef,
    sendingThreadIds,
    isThreadSending,
    beginRequest,
    finishRequest,
    setDebugDelayPending,
    cancelThreadRequest,
    selectedThread,
    draft,
    recentThreads,
    archivedThreads,
    textareaRef,
    messagesRef,
    openMenuThreadId,
    setOpenMenuThreadId,
    renamingThreadId,
    setRenamingThreadId,
    renameDraft,
    setRenameDraft,
    listDrawerOpen,
    setListDrawerOpen,
    createNewThread,
    selectThread,
    beginRename,
    commitRename,
    setArchived,
    deleteThread,
  };
}
