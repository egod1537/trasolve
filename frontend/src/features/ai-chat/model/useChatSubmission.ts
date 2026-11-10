import { CHAT_LIMITS } from '@trasolve/shared';
import { sendChat } from '@/features/ai-chat/api/chat';

import {
  parseDebugDelayCommand,
  waitForDebugDelay,
} from '@/features/ai-chat/ui/debugDelay';
import {
  logThreadRequestLifecycle,
  type ThreadRequestLifecycleStage,
} from '@/features/ai-chat/ui/requestLifecycle';

import {
  type Props,
  type UiChatMessage,
} from '@/features/ai-chat/model/chatTypes';

import { buildChatRequestMessages } from '@/features/ai-chat/model/chatThreads';

import type { useChatThreads } from './useChatThreads';
export function useChatSubmission({
  L,
  setThreads,
  threadMessagesRef,
  threadsRef,
  threadIdsRef,
  selectedThreadIdRef,
  draftsRef,
  setDrafts,
  nextMessageIdRef,
  openRef,
  isThreadSending,
  beginRequest,
  finishRequest,
  setDebugDelayPending,
  getRequestPreamble,
  model,
}: Pick<
  ReturnType<typeof useChatThreads>,
  | 'L'
  | 'setThreads'
  | 'threadMessagesRef'
  | 'threadsRef'
  | 'threadIdsRef'
  | 'selectedThreadIdRef'
  | 'draftsRef'
  | 'setDrafts'
  | 'nextMessageIdRef'
  | 'openRef'
  | 'isThreadSending'
  | 'beginRequest'
  | 'finishRequest'
  | 'setDebugDelayPending'
> &
  Pick<Props, 'getRequestPreamble' | 'model'>) {
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
      const preamble = await getRequestPreamble?.();
      const systemMessages = preamble?.systemMessages ?? [];
      if (controller.signal.aborted) {
        return;
      }
      const result = await sendChat(
        {
          messages: systemMessages.length
            ? [
                ...systemMessages,
                ...requestMessages.slice(
                  -(CHAT_LIMITS.messages - systemMessages.length),
                ),
              ]
            : requestMessages,
          ...(model ? { model } : {}),
          ...(preamble?.tools ? { tools: preamble.tools } : {}),
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
        ...(preamble?.context === undefined
          ? {}
          : { requestContext: preamble.context }),
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
                    : L(
                        'ai:mapAiPanel.submitMessage.error.answerCouldNotBeRetrievedTry',
                      ),
              }
            : thread,
        ),
      );
    } finally {
      finishRequest(threadId, request);
    }
  };

  return submitMessage;
}
