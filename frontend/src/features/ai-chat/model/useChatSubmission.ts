import { parseDebugDelayCommand } from './debugDelay';
import { logThreadRequestLifecycle } from './requestLifecycle';
import {
  appendSubmittedMessage,
  appendChatAnswer,
} from './chatSubmissionMessages';
import { sendChatSubmission } from './chatSubmissionRequest';
import type {
  ChatSubmissionOptions,
  SubmissionLogger,
} from './chatSubmissionTypes';

export function useChatSubmission(options: ChatSubmissionOptions) {
  return async () => {
    const {
      selectedThreadIdRef,
      draftsRef,
      isThreadSending,
      beginRequest,
      finishRequest,
      setThreads,
      L,
    } = options;
    const threadId = selectedThreadIdRef.current;
    const content = (draftsRef.current[threadId] ?? '').trim();
    if (!content || isThreadSending(threadId)) {
      return;
    }
    const command = parseDebugDelayCommand(content);
    const request = command.kind === 'invalid' ? null : beginRequest(threadId);
    if (command.kind !== 'invalid' && !request) {
      return;
    }
    const log: SubmissionLogger = (stage, details = {}) => {
      if (request) {
        logThreadRequestLifecycle(stage, {
          ...request,
          ...details,
          threadId,
          selectedThreadId: selectedThreadIdRef.current,
        });
      }
    };
    const messages = appendSubmittedMessage(
      options,
      threadId,
      content,
      command,
      log,
    );
    if (!messages || command.kind === 'invalid' || !request) {
      if (request) {
        finishRequest(threadId, request);
      }
      return;
    }
    try {
      const { result, context } = await sendChatSubmission(
        options,
        threadId,
        request,
        messages,
        command,
        log,
      );
      if (!request.controller.signal.aborted) {
        appendChatAnswer(options, threadId, result, context, log);
      }
    } catch (cause) {
      if (request.controller.signal.aborted) {
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
}
