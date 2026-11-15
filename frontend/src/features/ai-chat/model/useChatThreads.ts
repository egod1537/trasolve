import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { readProductChat, nextMessageId } from './chatPersistence';
import { useChatPersistence } from './useChatPersistence';
import {
  createThread,
  markAssistantMessagesRead,
  replaceThreadMessages,
  assertThreadMessageRefInvariant,
} from './chatThreads';
import type {
  ChatSessionOptions,
  ChatThread,
  UiChatMessage,
} from './chatTypes';

const EMPTY_MESSAGES: readonly UiChatMessage[] = [];

/** Owns thread snapshots and drafts; it has no dependency on panel presentation. */
export function useChatThreads({
  open,
  persistenceKey,
}: Pick<ChatSessionOptions, 'open' | 'persistenceKey'>) {
  const [initialProductChat] = useState(() => readProductChat(persistenceKey));
  const [threads, setThreads] = useState<ChatThread[]>(() => [
    createThread('chat-1', initialProductChat?.messages),
  ]);
  const threadMessagesRef = useRef(new Map([['chat-1', threads[0]!.messages]]));
  const threadsRef = useRef(threads);
  const threadIdsRef = useRef(new Set(['chat-1']));
  const [selectedThreadId, setSelectedThreadId] = useState('chat-1');
  const selectedThreadIdRef = useRef(selectedThreadId);
  const [drafts, setDrafts] = useState<Record<string, string>>(
    (): Record<string, string> =>
      initialProductChat ? { 'chat-1': initialProductChat.draft } : {},
  );
  const draftsRef = useRef(drafts);
  const nextThreadIdRef = useRef(2);
  const nextMessageIdRef = useRef(
    nextMessageId(initialProductChat?.messages ?? []),
  );
  const openRef = useRef(open);
  useLayoutEffect(() => {
    openRef.current = open;
    selectedThreadIdRef.current = selectedThreadId;
  }, [open, selectedThreadId]);
  useLayoutEffect(() => {
    threadsRef.current = threads;
    threadIdsRef.current = new Set(threads.map((thread) => thread.id));
    assertThreadMessageRefInvariant(threads, threadMessagesRef.current);
  }, [threads]);
  useChatPersistence(
    persistenceKey,
    threads[0]?.messages ?? EMPTY_MESSAGES,
    drafts['chat-1'] ?? '',
  );
  const getSelectedThreadId = useCallback(
    () => selectedThreadIdRef.current,
    [],
  );
  const changeSelectedThread = useCallback((threadId: string) => {
    selectedThreadIdRef.current = threadId;
    setSelectedThreadId(threadId);
  }, []);
  const changeDraft = useCallback((value: string) => {
    const threadId = selectedThreadIdRef.current;
    draftsRef.current = { ...draftsRef.current, [threadId]: value };
    setDrafts(draftsRef.current);
  }, []);
  const markThreadRead = useCallback((threadId: string) => {
    const snapshot = threadMessagesRef.current.get(threadId);
    if (!snapshot) {
      return;
    }
    const nextMessages = markAssistantMessagesRead(snapshot);
    threadMessagesRef.current.set(threadId, nextMessages);
    setThreads((current) =>
      replaceThreadMessages(current, threadId, nextMessages),
    );
  }, []);
  return {
    threads,
    setThreads,
    threadMessagesRef,
    threadsRef,
    threadIdsRef,
    selectedThreadId,
    selectedThreadIdRef,
    drafts,
    draftsRef,
    setDrafts,
    nextThreadIdRef,
    nextMessageIdRef,
    openRef,
    getSelectedThreadId,
    changeSelectedThread,
    changeDraft,
    markThreadRead,
  };
}
export type ChatThreadState = ReturnType<typeof useChatThreads>;
