import type { ChatMessage, ChatRequest, ChatResponse } from '@trasolve/shared';
import type { Localize } from '@/shared/i18n';
import type { ChatSessionOptions } from './chatTypes';
import type { ChatThreadState } from './useChatThreads';
import type { useThreadRequests } from './useThreadRequests';
import type { ThreadRequestLifecycleStage } from './requestLifecycle';

export type ChatSubmissionStore = Pick<
  ChatThreadState,
  | 'setThreads'
  | 'threadMessagesRef'
  | 'threadsRef'
  | 'threadIdsRef'
  | 'selectedThreadIdRef'
  | 'draftsRef'
  | 'setDrafts'
  | 'nextMessageIdRef'
  | 'openRef'
>;
export type ChatSubmissionOptions = ChatSubmissionStore &
  Pick<
    ReturnType<typeof useThreadRequests>,
    | 'isThreadSending'
    | 'beginRequest'
    | 'finishRequest'
    | 'setDebugDelayPending'
  > &
  Pick<ChatSessionOptions, 'getRequestPreamble' | 'model'> & {
    L: Localize;
    sendRequest?: (
      request: ChatRequest,
      signal: AbortSignal,
      threadId: string,
    ) => Promise<ChatResponse>;
  };
export type SubmissionLogger = (
  stage: ThreadRequestLifecycleStage,
  details?: { messageCount?: number; reason?: unknown },
) => void;
export type SubmittedMessages = ChatMessage[];
