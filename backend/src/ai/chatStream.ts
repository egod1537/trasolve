import { z } from 'zod';
import {
  chatResponseSchema,
  type ChatRequest,
  type ChatResponse,
  type ChatStreamEvent,
} from '@trasolve/shared';
import type { ChatProvider, ChatStreamOptions } from './chatProvider.js';

const followUpsSchema = z.array(z.string().trim().min(1).max(160)).max(3);

export async function runChatStream(
  provider: ChatProvider,
  request: ChatRequest,
  options: ChatStreamOptions,
): Promise<ChatResponse> {
  options.signal.throwIfAborted();
  options.onEvent({ type: 'status', stage: 'waiting' });
  options.onEvent({ type: 'status', stage: 'generating' });
  const result = chatResponseSchema.parse(
    provider.stream
      ? await provider.stream(request, options)
      : await provider.chat(request, options.signal),
  );
  options.signal.throwIfAborted();
  if (request.generateFollowUps === false) {
    return result;
  }
  const followUps = await generateFollowUps(
    provider,
    request,
    result,
    options.signal,
  );
  options.signal.throwIfAborted();
  return { ...result, followUps };
}

async function generateFollowUps(
  provider: ChatProvider,
  request: ChatRequest,
  result: ChatResponse,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const reply = await provider.chat(
      {
        // Use the requested alias (or provider default); returned model IDs may
        // be underlying provider names that are not routable through the proxy.
        ...(request.model ? { model: request.model } : {}),
        webSearch: false,
        messages: [
          {
            role: 'system',
            content:
              'Suggest up to three useful next messages the user could send about this travel conversation. Use the language of the latest user message. Return ONLY a JSON array of strings, each at most 160 characters. Do not execute tasks or propose tools. Return [] if no relevant follow-up exists.',
          },
          ...request.messages
            .filter((message) => message.role !== 'system')
            .slice(-2),
          result.message,
        ],
      },
      AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    );
    const text = reply.message.content
      .trim()
      .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
    const parsed = followUpsSchema.safeParse(JSON.parse(text));
    return parsed.success ? [...new Set(parsed.data)] : [];
  } catch {
    // Suggestions are optional. Their failure never discards a valid answer.
    return [];
  }
}

export function writeChatStreamEvent(
  response: import('node:http').ServerResponse,
  event: ChatStreamEvent,
): void {
  if (response.destroyed || response.writableEnded) {
    return;
  }
  if (!response.headersSent) {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
  }
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}
