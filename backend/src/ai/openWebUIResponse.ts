import { z } from 'zod';
import {
  CHAT_LIMITS,
  chatWebImageSchema,
  type ChatMessage,
  type ChatWebImage,
} from '@trasolve/shared';

export const openWebUIOutputItemSchema = z.object({
  type: z.string(),
  role: z.string().optional(),
  content: z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .optional(),
  results: z
    .array(
      z.object({
        type: z.string(),
        image_url: z.string().optional(),
        thumbnail_url: z.string().nullish(),
        source_website_url: z.string().optional(),
        caption: z.string().nullish(),
      }),
    )
    .optional(),
});

export const openWebUIResponseSchema = z.object({
  model: z.string().trim().min(1),
  status: z.string().trim().min(1).optional(),
  output: z.array(openWebUIOutputItemSchema),
  usage: z.unknown().optional(),
});

export type OpenWebUIOutputItem = z.infer<typeof openWebUIOutputItemSchema>;

type OpenWebUIOutput = OpenWebUIOutputItem[];

export function buildOpenWebUIResponseBody(
  model: string,
  messages: ChatMessage[],
  stream: boolean,
  webSearch: boolean,
): Record<string, unknown> {
  return {
    model,
    input: messages.map((message) => ({
      role: message.role,
      content: [
        {
          type: message.role === 'assistant' ? 'output_text' : 'input_text',
          text: message.content,
        },
      ],
    })),
    tools: webSearch
      ? [
          {
            type: 'web_search',
            search_content_types: ['image', 'text'],
            image_settings: {
              max_results: CHAT_LIMITS.webImages,
              caption: true,
            },
          },
        ]
      : [],
    tool_choice: webSearch ? 'auto' : 'none',
    ...(webSearch ? { include: ['web_search_call.results'] } : {}),
    store: false,
    stream,
  };
}

export function extractAssistantText(output: OpenWebUIOutput): string {
  return output
    .filter((item) => item.type === 'message' && item.role === 'assistant')
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text ?? '')
    .join('');
}

export function extractWebImages(output: OpenWebUIOutput): ChatWebImage[] {
  const images: ChatWebImage[] = [];
  const seen = new Set<string>();
  const results = output
    .filter((item) => item.type === 'web_search_call')
    .flatMap((item) => item.results ?? []);
  for (const result of results) {
    if (
      result.type !== 'image_result' ||
      !result.image_url ||
      !result.source_website_url
    ) {
      continue;
    }
    const parsed = chatWebImageSchema.safeParse({
      imageUrl: result.image_url,
      ...(result.thumbnail_url ? { thumbnailUrl: result.thumbnail_url } : {}),
      sourceUrl: result.source_website_url,
      ...(result.caption ? { caption: result.caption } : {}),
    });
    if (!parsed.success || seen.has(parsed.data.imageUrl)) {
      continue;
    }
    seen.add(parsed.data.imageUrl);
    images.push(parsed.data);
    if (images.length === CHAT_LIMITS.webImages) {
      break;
    }
  }
  return images;
}
