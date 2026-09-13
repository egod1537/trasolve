import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { CHAT_LIMITS, type ChatMessage } from '@trasolve/shared';
import { sendChat } from '../../../api/chat';
import { downloadChatMarkdown } from '../../utils/chatMarkdown';
import { ChatMarkdown } from './ChatMarkdown';
import { parseDebugDelayCommand, waitForDebugDelay } from './debugDelay';
import {
  logThreadRequestLifecycle,
  type ThreadRequestLifecycleStage,
} from './requestLifecycle';
import { useThreadRequests } from './useThreadRequests';
import './chat-panel.css';

type Props = {
  open: boolean;
  onClose?: () => void;
  onGeneratingChange?: (generating: boolean) => void;
  onUnreadPreviewsChange?: (previews: MapAiUnreadPreview[]) => void;
};

type UiChatMessage = ChatMessage & {
  id: string;
  createdAt: number;
  unread: boolean;
  requestContent?: string | null;
};

export type MapAiUnreadPreview = {
  messageId: string;
  threadId: string;
  threadTitle: string;
  content: string;
  createdAt: number;
};

export type MapAiPanelHandle = {
  viewSelectedThread(): void;
  viewThread(threadId: string): void;
};

type ChatThread = {
  id: string;
  title: string;
  messages: UiChatMessage[];
  updatedAt: number;
  archived: boolean;
  error: string | null;
};

function createThread(id: string): ChatThread {
  return {
    id,
    title: '새 채팅',
    messages: [],
    updatedAt: Date.now(),
    archived: false,
    error: null,
  };
}

function formatRelativeTime(timestamp: number): string {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 60000),
  );
  if (elapsedMinutes < 1) {
    return '방금 전';
  }
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}분 전`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours}시간 전`;
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays < 7
    ? `${elapsedDays}일 전`
    : new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
      }).format(timestamp);
}

function getUnreadPreviews(threads: ChatThread[]): MapAiUnreadPreview[] {
  return threads
    .flatMap((thread) =>
      thread.messages.flatMap((message) =>
        message.role === 'assistant' && message.unread
          ? [
              {
                messageId: message.id,
                threadId: thread.id,
                threadTitle: thread.title,
                content: message.content,
                createdAt: message.createdAt,
              },
            ]
          : [],
      ),
    )
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 3);
}

function buildChatRequestMessages(
  messages: readonly UiChatMessage[],
): ChatMessage[] {
  return messages
    .filter((message) => message.requestContent !== null)
    .slice(-CHAT_LIMITS.messages)
    .map(({ role, content, requestContent }) => ({
      role,
      content: requestContent ?? content,
    }));
}

function markAssistantMessagesRead(messages: UiChatMessage[]): UiChatMessage[] {
  let changed = false;
  const next = messages.map((message) => {
    if (message.role !== 'assistant' || !message.unread) {
      return message;
    }
    changed = true;
    return { ...message, unread: false };
  });
  return changed ? next : messages;
}

function assertThreadMessageRefInvariant(
  threads: readonly ChatThread[],
  refs: ReadonlyMap<string, UiChatMessage[]>,
): void {
  if (!import.meta.env.DEV) {
    return;
  }
  for (const thread of threads) {
    const snapshot = refs.get(thread.id);
    if (!snapshot) {
      console.error('[Trasolve chat invariant] missing message snapshot', {
        threadId: thread.id,
      });
    } else if (snapshot !== thread.messages) {
      console.error('[Trasolve chat invariant] stale message snapshot', {
        threadId: thread.id,
        refMessageCount: snapshot.length,
        stateMessageCount: thread.messages.length,
      });
    }
  }
}

export const MapAiPanel = forwardRef<MapAiPanelHandle, Props>(
  function MapAiPanel(
    { open, onClose, onGeneratingChange, onUnreadPreviewsChange },
    ref,
  ) {
    const [threads, setThreads] = useState<ChatThread[]>(() => [
      createThread('chat-1'),
    ]);
    const threadMessagesRef = useRef<Map<string, UiChatMessage[]>>(
      new Map([['chat-1', threads[0]!.messages]]),
    );
    const threadsRef = useRef(threads);
    const threadIdsRef = useRef(new Set(['chat-1']));
    const [selectedThreadId, setSelectedThreadId] = useState('chat-1');
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const draftsRef = useRef<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [openMenuThreadId, setOpenMenuThreadId] = useState<string | null>(
      null,
    );
    const [renamingThreadId, setRenamingThreadId] = useState<string | null>(
      null,
    );
    const [renameDraft, setRenameDraft] = useState('');
    const [listDrawerOpen, setListDrawerOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);
    const nextThreadIdRef = useRef(2);
    const nextMessageIdRef = useRef(1);
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
    const selectedThread =
      threads.find((thread) => thread.id === selectedThreadId) ?? threads[0]!;
    const draft = drafts[selectedThread.id] ?? '';
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ko-KR');
    const visibleThreads = threads
      .filter(
        (thread) =>
          !normalizedQuery ||
          thread.title.toLocaleLowerCase('ko-KR').includes(normalizedQuery),
      )
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const recentThreads = visibleThreads.filter((thread) => !thread.archived);
    const archivedThreads = visibleThreads.filter((thread) => thread.archived);
    const selectedThreadSending = sendingThreadIds.has(selectedThread.id);
    const generating = sendingThreadIds.size > 0;
    const unreadPreviews = useMemo(() => getUnreadPreviews(threads), [threads]);

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

    useEffect(() => {
      if (open) {
        textareaRef.current?.focus({ preventScroll: true });
      }
    }, [open, selectedThreadId]);

    useEffect(() => {
      messagesRef.current?.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, [
      selectedThread.id,
      selectedThread.messages.length,
      selectedThread.error,
      selectedThreadSending,
      open,
    ]);

    useEffect(() => {
      if (!openMenuThreadId) {
        return;
      }
      const closeOnOutsidePointer = (event: PointerEvent) => {
        if (
          event.target instanceof Element &&
          !event.target.closest('.trip-ai-chat-item-more')
        ) {
          setOpenMenuThreadId(null);
        }
      };
      const closeOnEscape = (event: globalThis.KeyboardEvent) => {
        if (event.key === 'Escape') {
          setOpenMenuThreadId(null);
        }
      };
      document.addEventListener('pointerdown', closeOnOutsidePointer);
      document.addEventListener('keydown', closeOnEscape);
      return () => {
        document.removeEventListener('pointerdown', closeOnOutsidePointer);
        document.removeEventListener('keydown', closeOnEscape);
      };
    }, [openMenuThreadId]);

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
      setRenameDraft(thread.title);
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
            ? { ...thread, title, updatedAt: Date.now() }
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
      const remainingThreads = threads.filter(
        (thread) => thread.id !== threadId,
      );
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

    const submitMessage = async () => {
      const threadId = selectedThreadIdRef.current;
      const content = (draftsRef.current[threadId] ?? '').trim();
      if (!content || isThreadSending(threadId)) {
        return;
      }

      const delayCommand = parseDebugDelayCommand(content);
      const request =
        delayCommand.kind === 'invalid' ? null : beginRequest(threadId);
      if (delayCommand.kind !== 'invalid' && !request) {
        return;
      }
      const logLifecycle = (
        stage: ThreadRequestLifecycleStage,
        details: { messageCount?: number; reason?: unknown } = {},
      ) => {
        if (!request) {
          return;
        }
        logThreadRequestLifecycle(stage, {
          ...request,
          ...details,
          threadId,
          selectedThreadId: selectedThreadIdRef.current,
        });
      };
      const requestContent =
        delayCommand.kind === 'valid'
          ? delayCommand.prompt
          : delayCommand.kind === 'invalid'
            ? null
            : undefined;
      const userMessageId = `user-${nextMessageIdRef.current++}`;
      const submittedAt = Date.now();
      const userMessage: UiChatMessage = {
        id: userMessageId,
        role: 'user',
        content,
        createdAt: submittedAt,
        unread: false,
        requestContent,
      };
      const currentMessages = threadMessagesRef.current.get(threadId);
      if (!currentMessages) {
        logLifecycle('REQUEST_DROPPED', {
          reason: threadIdsRef.current.has(threadId)
            ? 'missing-message-snapshot'
            : 'thread-deleted',
        });
        if (request) {
          finishRequest(threadId, request);
        }
        return;
      }
      const nextMessages = [...currentMessages, userMessage];
      const requestMessages = buildChatRequestMessages(nextMessages);
      threadMessagesRef.current.set(threadId, nextMessages);
      logLifecycle('USER_MESSAGE_APPENDED', {
        messageCount: nextMessages.length,
      });
      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: nextMessages,
                updatedAt: submittedAt,
                error:
                  delayCommand.kind === 'invalid' ? delayCommand.error : null,
              }
            : thread,
        ),
      );
      draftsRef.current = { ...draftsRef.current, [threadId]: '' };
      setDrafts(draftsRef.current);
      if (delayCommand.kind === 'invalid') {
        return;
      }
      if (!request) {
        return;
      }
      const { controller } = request;
      try {
        if (delayCommand.kind === 'valid') {
          setDebugDelayPending(threadId, request, true);
          logLifecycle('DELAY_STARTED');
          try {
            await waitForDebugDelay(delayCommand.delayMs, controller.signal);
            logLifecycle('DELAY_FINISHED');
          } finally {
            setDebugDelayPending(threadId, request, false);
          }
        }
        logLifecycle('SEND_CHAT_STARTED', {
          messageCount: requestMessages.length,
        });
        const result = await sendChat(
          {
            messages: requestMessages,
          },
          controller.signal,
        );
        logLifecycle('SEND_CHAT_RESOLVED');
        if (controller.signal.aborted) {
          return;
        }
        const completedAt = Date.now();
        const message: UiChatMessage = {
          ...result.message,
          id: `assistant-${nextMessageIdRef.current++}`,
          createdAt: completedAt,
          unread: !openRef.current || selectedThreadIdRef.current !== threadId,
        };
        let latestMessages = threadMessagesRef.current.get(threadId);
        if (!latestMessages && threadIdsRef.current.has(threadId)) {
          latestMessages = threadsRef.current.find(
            (thread) => thread.id === threadId,
          )?.messages;
          if (latestMessages) {
            threadMessagesRef.current.set(threadId, latestMessages);
          }
        }
        if (!latestMessages) {
          logLifecycle('REQUEST_DROPPED', {
            reason: threadIdsRef.current.has(threadId)
              ? 'missing-message-snapshot'
              : 'thread-deleted',
          });
          return;
        }
        const completedMessages = [...latestMessages, message];
        threadMessagesRef.current.set(threadId, completedMessages);
        logLifecycle('ASSISTANT_MESSAGE_APPENDED', {
          messageCount: completedMessages.length,
        });
        setThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  messages: completedMessages,
                  updatedAt: completedAt,
                }
              : thread,
          ),
        );
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }
        setThreads((current) =>
          current.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  error:
                    cause instanceof Error
                      ? cause.message
                      : '답변을 불러올 수 없습니다. 다시 시도해 주세요.',
                }
              : thread,
          ),
        );
      } finally {
        finishRequest(threadId, request);
      }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void submitMessage();
    };

    const handleComposerKeyDown = (
      event: KeyboardEvent<HTMLTextAreaElement>,
    ) => {
      if (
        event.key !== 'Enter' ||
        event.shiftKey ||
        event.nativeEvent.isComposing
      ) {
        return;
      }

      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    };

    const renderThread = (thread: ChatThread) => (
      <li
        key={thread.id}
        className={`trip-ai-chat-item${thread.id === selectedThread.id ? ' is-selected' : ''}${sendingThreadIds.has(thread.id) ? ' is-generating' : ''}`}
      >
        {renamingThreadId === thread.id ? (
          <form
            className="trip-ai-chat-rename"
            onSubmit={(event) => {
              event.preventDefault();
              commitRename(thread.id);
            }}
          >
            <input
              autoFocus
              value={renameDraft}
              aria-label="채팅 이름"
              maxLength={80}
              onChange={(event) => setRenameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') {
                  return;
                }
                setRenamingThreadId(null);
                setRenameDraft('');
              }}
            />
            <button type="submit" disabled={!renameDraft.trim()}>
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setRenamingThreadId(null);
                setRenameDraft('');
              }}
            >
              취소
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="trip-ai-chat-select"
              aria-pressed={thread.id === selectedThread.id}
              onClick={() => selectThread(thread.id)}
            >
              <span className="trip-ai-chat-title">
                <span className="trip-ai-chat-title-text">{thread.title}</span>
                {sendingThreadIds.has(thread.id) && (
                  <span
                    className="trip-ai-chat-generating"
                    role="status"
                    aria-label="AI 응답 생성 중"
                  />
                )}
              </span>
              <time dateTime={new Date(thread.updatedAt).toISOString()}>
                {formatRelativeTime(thread.updatedAt)}
              </time>
            </button>
            <div className="trip-ai-chat-item-more">
              <button
                type="button"
                className="trip-ai-chat-more-button"
                aria-label={`${thread.title} 메뉴`}
                title="채팅 메뉴"
                aria-haspopup="menu"
                aria-expanded={openMenuThreadId === thread.id}
                onClick={() =>
                  setOpenMenuThreadId((current) =>
                    current === thread.id ? null : thread.id,
                  )
                }
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="19" cy="12" r="1.5" />
                </svg>
              </button>
              {openMenuThreadId === thread.id && (
                <div className="trip-ai-chat-menu" role="menu">
                  {sendingThreadIds.has(thread.id) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        cancelThreadRequest(thread.id, 'explicit-cancel');
                        setOpenMenuThreadId(null);
                      }}
                    >
                      생성 취소
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => beginRename(thread)}
                  >
                    이름 변경
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => setArchived(thread.id, !thread.archived)}
                  >
                    {thread.archived ? '보관 해제' : '보관'}
                  </button>
                  <button
                    type="button"
                    className="is-destructive"
                    role="menuitem"
                    onClick={() => deleteThread(thread.id)}
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </li>
    );

    return (
      <aside
        id="trip-map-ai-panel"
        className={`trip-map-ai-panel${open ? ' is-open' : ''}`}
        aria-label="Trasolve AI 여행 도우미"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="trip-ai-chat-layout">
          {listDrawerOpen && (
            <button
              type="button"
              className="trip-ai-chat-list-backdrop"
              aria-label="채팅 목록 닫기"
              onClick={() => setListDrawerOpen(false)}
            />
          )}
          <aside
            id="trip-ai-chat-list"
            className={`trip-ai-chat-list${listDrawerOpen ? ' is-mobile-open' : ''}`}
            aria-label="AI 채팅 목록"
          >
            <header className="trip-ai-chat-list-header">
              <h2>Trasolve AI</h2>
              <button type="button" onClick={createNewThread}>
                <span aria-hidden="true">＋</span> 새 채팅
              </button>
            </header>
            <label className="trip-ai-chat-search">
              <span className="sr-only">채팅 검색</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 5 5" />
              </svg>
              <input
                type="search"
                value={searchQuery}
                placeholder="채팅 검색"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
            <div className="trip-ai-chat-list-content">
              <section aria-labelledby="trip-ai-recent-chats-title">
                <h3 id="trip-ai-recent-chats-title">최근 대화</h3>
                {recentThreads.length ? (
                  <ul>{recentThreads.map(renderThread)}</ul>
                ) : (
                  <p className="trip-ai-chat-list-empty">대화가 없습니다.</p>
                )}
              </section>
              {!!archivedThreads.length && (
                <section aria-labelledby="trip-ai-archived-chats-title">
                  <h3 id="trip-ai-archived-chats-title">보관됨</h3>
                  <ul>{archivedThreads.map(renderThread)}</ul>
                </section>
              )}
            </div>
          </aside>

          <section className="trip-ai-conversation" aria-label="현재 대화">
            <header className="trip-map-ai-panel-header">
              <button
                type="button"
                className="trip-ai-chat-list-toggle"
                aria-label="채팅 목록 열기"
                aria-controls="trip-ai-chat-list"
                aria-expanded={listDrawerOpen}
                onClick={() => setListDrawerOpen(true)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <div>
                <h2>{selectedThread.title}</h2>
                <p>여행 도우미</p>
              </div>
              {onClose && (
                <div className="trip-map-ai-panel-actions">
                  <button
                    type="button"
                    className="trip-map-ai-panel-export"
                    aria-label="Markdown으로 저장"
                    title="Markdown으로 저장"
                    disabled={!selectedThread.messages.length}
                    onClick={() =>
                      downloadChatMarkdown(selectedThread.messages)
                    }
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="trip-map-ai-panel-close"
                    aria-label="Close AI assistant"
                    onClick={onClose}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m6 6 12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
              )}
            </header>

            <div
              ref={messagesRef}
              className="trip-map-ai-messages"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {!selectedThread.messages.length && (
                <p className="trip-map-ai-message is-assistant">
                  지도와 일정을 보면서 여행 계획을 도와드릴게요.
                </p>
              )}
              {selectedThread.messages.map((message) =>
                message.role === 'assistant' ? (
                  <div
                    key={message.id}
                    className="trip-map-ai-message is-assistant"
                  >
                    <ChatMarkdown content={message.content} />
                  </div>
                ) : (
                  <p key={message.id} className="trip-map-ai-message is-user">
                    {message.content}
                  </p>
                ),
              )}
              {selectedThreadSending && (
                <p className="trip-map-ai-message is-assistant" role="status">
                  <span className="sr-only">답변을 생각하고 있어요.</span>
                  <span className="trip-map-ai-typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </p>
              )}
              {selectedThread.error && (
                <p className="trip-map-ai-message is-assistant" role="alert">
                  {selectedThread.error}
                </p>
              )}
            </div>

            <form
              className="trip-map-ai-compose"
              aria-busy={selectedThreadSending}
              onSubmit={handleSubmit}
            >
              <label className="sr-only" htmlFor="trip-map-ai-input">
                AI 여행 도우미에게 메시지 보내기
              </label>
              <textarea
                ref={textareaRef}
                id="trip-map-ai-input"
                rows={1}
                maxLength={CHAT_LIMITS.messageLength}
                value={draft}
                placeholder="여행에 대해 물어보세요"
                onChange={(event) => {
                  const threadId = selectedThreadIdRef.current;
                  draftsRef.current = {
                    ...draftsRef.current,
                    [threadId]: event.target.value,
                  };
                  setDrafts(draftsRef.current);
                }}
                onKeyDown={handleComposerKeyDown}
              />
              <button
                type="submit"
                disabled={selectedThreadSending || !draft.trim()}
              >
                {selectedThreadSending ? '생성 중' : '전송'}
              </button>
            </form>
          </section>
        </div>
      </aside>
    );
  },
);
