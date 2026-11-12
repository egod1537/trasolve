import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { ModelTokenUsage } from './tokenPricing.js';

const usageContext = new AsyncLocalStorage<ModelTokenUsage[]>();
const count = z.number().int().nonnegative().safe();
const usageSchema = z.object({
  input_tokens: count,
  output_tokens: count,
  input_tokens_details: z.object({ cached_tokens: count.optional() }).nullish(),
});

export async function collectChatUsage<T>(operation: () => Promise<T>) {
  const calls: ModelTokenUsage[] = [];
  const result = await usageContext.run(calls, operation);
  return { result, calls };
}

/** Called once per completed upstream invocation, including follow-up generation. */
export function recordChatUsage(
  model: string,
  messages: readonly { content: string }[],
  output: string,
  usage: unknown,
): void {
  const calls = usageContext.getStore();
  if (!calls) {
    return;
  }
  const parsed = usageSchema.safeParse(usage);
  calls.push(
    parsed.success
      ? {
          model,
          input: parsed.data.input_tokens,
          output: parsed.data.output_tokens,
          cachedInput: parsed.data.input_tokens_details?.cached_tokens ?? 0,
          estimated: false,
        }
      : {
          model,
          // Compatibility for proxies without usage: an explicitly recorded estimate.
          input: messages.reduce(
            (n, message) => n + estimate(message.content) + 4,
            0,
          ),
          output: estimate(output),
          cachedInput: 0,
          estimated: true,
        },
  );
}

function estimate(text: string): number {
  return Math.ceil(Buffer.byteLength(text, 'utf8') / 4);
}
