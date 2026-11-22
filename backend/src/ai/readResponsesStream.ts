import { recordChatUsage } from '../billing/chatUsage.js';
import { z } from 'zod';
import {
  CHAT_LIMITS,
  chatResponseSchema,
  chatToolProgressSchema,
  readSseData,
  type ChatResponse,
} from '@trasolve/shared';
import type { ChatStreamOptions } from './chatProvider.js';
import {
  extractAssistantText,
  extractWebImages,
  openWebUIOutputItemSchema,
  openWebUIResponseSchema,
  type OpenWebUIOutputItem,
} from './openWebUIResponse.js';

const frameSchema = z.object({
  type: z.string(),
  delta: z.string().optional(),
  item: z.unknown().optional(),
  output_index: z.unknown().optional(),
  response: z.unknown().optional(),
});
const webSearchItemSchema = z.object({
  type: z.literal('web_search_call'),
  status: z.string().optional(),
});

function readWebSearchProgress(event: z.infer<typeof frameSchema>) {
  let status: 'running' | 'completed' | 'failed' | undefined;
  switch (event.type) {
    case 'response.web_search_call.in_progress':
    case 'response.web_search_call.searching':
      status = 'running';
      break;
    case 'response.web_search_call.completed':
      status = 'completed';
      break;
    case 'response.output_item.added':
    case 'response.output_item.done': {
      const item = webSearchItemSchema.safeParse(event.item);
      if (item.success) {
        switch (item.data.status) {
          case 'in_progress':
          case 'searching':
            status = 'running';
            break;
          case 'completed':
          case 'failed':
            status = item.data.status;
            break;
        }
      }
      break;
    }
  }
  if (!status) {
    return undefined;
  }
  const progress = chatToolProgressSchema.safeParse({
    tool: 'web_search',
    index: event.output_index,
    status,
  });
  return progress.success ? progress.data : undefined;
}

export async function readResponsesStream(
  response: Response,
  model: string,
  options: ChatStreamOptions,
  messages: readonly { content: string }[],
): Promise<ChatResponse> {
  if (
    !response.body ||
    !response.headers.get('content-type')?.startsWith('text/event-stream')
  ) {
    throw new Error('Expected a Responses SSE stream');
  }
  let content = '';
  let summary = '';
  const completedOutputItems: OpenWebUIOutputItem[] = [];
  for await (const data of readSseData(response.body, new TextDecoder())) {
    options.signal.throwIfAborted();
    if (data === '[DONE]') {
      break;
    }
    const event = frameSchema.parse(JSON.parse(data));
    const progress = readWebSearchProgress(event);
    if (progress) {
      options.onEvent({ type: 'tool', ...progress });
    }
    if (event.type === 'response.output_item.done') {
      completedOutputItems.push(openWebUIOutputItemSchema.parse(event.item));
    } else if (event.type === 'response.output_text.delta' && event.delta) {
      content += event.delta;
      if (content.length > CHAT_LIMITS.messageLength) {
        throw new Error('Chat response exceeds the size limit');
      }
      options.onEvent({ type: 'text', text: event.delta });
    } else if (
      event.type === 'response.reasoning_summary_text.delta' &&
      event.delta
    ) {
      // Only the provider's public summary is forwarded, never raw reasoning.
      const text = event.delta.slice(0, Math.max(0, 8000 - summary.length));
      summary += text;
      if (text) {
        options.onEvent({ type: 'summary', text });
      }
    } else if (event.type === 'response.completed') {
      const result = openWebUIResponseSchema.parse(event.response);
      const output = completedOutputItems.length
        ? completedOutputItems
        : result.output;
      const finalText = extractAssistantText(output);
      const webImages = extractWebImages(output);
      recordChatUsage(
        result.model,
        messages,
        finalText || content,
        result.usage,
      );
      return chatResponseSchema.parse({
        model: result.model ?? model,
        message: { role: 'assistant', content: finalText || content },
        ...(webImages.length ? { webImages } : {}),
        ...(summary ? { summary } : {}),
      });
    } else if (
      ['error', 'response.failed', 'response.incomplete'].includes(event.type)
    ) {
      throw new Error('Responses stream failed');
    }
  }
  throw new Error('Responses stream ended without completion');
}
