import { CHAT_LIMITS } from '@trasolve/shared';
import { sendChat } from '../api/chat';
import { waitForDebugDelay, type DebugDelayCommand } from './debugDelay';
import type { ThreadRequestHandle } from './useThreadRequests';
import type {
  ChatSubmissionOptions,
  SubmissionLogger,
  SubmittedMessages,
} from './chatSubmissionTypes';

/** Capture the trip preamble once, then use either normal or streaming transport. */
export async function sendChatSubmission(
  options: ChatSubmissionOptions,
  threadId: string,
  request: ThreadRequestHandle,
  messages: SubmittedMessages,
  command: DebugDelayCommand,
  log: SubmissionLogger,
) {
  const { signal } = request.controller;
  if (command.kind === 'valid') {
    options.setDebugDelayPending(threadId, request, true);
    log('DELAY_STARTED');
    try {
      await waitForDebugDelay(command.delayMs, signal);
      log('DELAY_FINISHED');
    } finally {
      options.setDebugDelayPending(threadId, request, false);
    }
  }
  log('SEND_CHAT_STARTED', { messageCount: messages.length });
  const preamble = await options.getRequestPreamble?.(
    [...messages].reverse().find((message) => message.role === 'user')
      ?.content ?? '',
  );
  const systemMessages = preamble?.systemMessages ?? [];
  signal.throwIfAborted();
  const result = await (options.sendRequest ?? sendChat)(
    {
      messages: systemMessages.length
        ? [
            ...systemMessages,
            ...messages.slice(-(CHAT_LIMITS.messages - systemMessages.length)),
          ]
        : messages,
      ...(options.model ? { model: options.model } : {}),
      ...(preamble?.tools ? { tools: preamble.tools } : {}),
    },
    signal,
    threadId,
  );
  log('SEND_CHAT_RESOLVED');
  signal.throwIfAborted();
  return { result, context: preamble?.context };
}
