import type { ChatThread } from './chatTypes';
import { createThread } from './chatThreads';
import type { ChatThreadState } from './useChatThreads';

/** Synchronous thread edits keep request snapshots in step with React state. */
export function createChatThreadActions(state: ChatThreadState) {
  const {
    setThreads,
    threadMessagesRef,
    threadIdsRef,
    changeSelectedThread,
    selectedThreadIdRef,
    draftsRef,
    setDrafts,
    threads,
  } = state;
  const createNewThread = () => {
    const thread = allocateThread(state);
    setThreads((current) => [thread, ...current]);
    changeSelectedThread(thread.id);
  };
  const renameThread = (threadId: string, value: string) => {
    const title = value.trim();
    if (!title) {
      return;
    }
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? { ...thread, title, titleIsDefault: false, updatedAt: Date.now() }
          : thread,
      ),
    );
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
        replacement = allocateThread(state);
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
  };
  const deleteThread = (threadId: string) => {
    threadMessagesRef.current.delete(threadId);
    threadIdsRef.current.delete(threadId);
    const remaining = threads.filter((thread) => thread.id !== threadId);
    const replacement = remaining.length ? null : allocateThread(state);
    if (selectedThreadIdRef.current === threadId) {
      changeSelectedThread(
        remaining.find((thread) => !thread.archived)?.id ??
          remaining[0]?.id ??
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
  };
  return { createNewThread, renameThread, setArchived, deleteThread };
}

function allocateThread(state: ChatThreadState): ChatThread {
  const thread = createThread(`chat-${state.nextThreadIdRef.current++}`);
  state.threadMessagesRef.current.set(thread.id, thread.messages);
  state.threadIdsRef.current.add(thread.id);
  return thread;
}
