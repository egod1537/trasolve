import { z } from 'zod';
import { CHAT_LIMITS } from '../constants/chat.js';
import { tripCommandPlanSchema } from './tripCommandPlan.js';

export const chatRoleSchema = z.enum(['system', 'user', 'assistant']);

export const chatToolNameSchema = z.literal('propose_trip_command_plan');

const httpsUrlSchema = z
  .string()
  .trim()
  .max(8192)
  .url()
  .refine((value) => /^https:\/\//i.test(value));

export const chatWebImageSchema = z.strictObject({
  imageUrl: httpsUrlSchema,
  thumbnailUrl: httpsUrlSchema.optional(),
  sourceUrl: httpsUrlSchema,
  caption: z.string().trim().min(1).max(500).optional(),
});

export const chatMessageSchema = z.strictObject({
  role: chatRoleSchema,
  content: z.string().trim().min(1).max(CHAT_LIMITS.messageLength),
});

export const chatRequestSchema = z.strictObject({
  messages: z.array(chatMessageSchema).min(1).max(CHAT_LIMITS.messages),
  model: z.string().trim().min(1).optional(),
  webSearch: z.boolean().optional(),
  /** Tools the model may call. Absent means a plain text chat. */
  tools: z.array(chatToolNameSchema).max(1).optional(),
});

export const chatResponseSchema = z.strictObject({
  model: z.string().trim().min(1),
  message: chatMessageSchema.extend({ role: z.literal('assistant') }),
  webImages: z.array(chatWebImageSchema).max(CHAT_LIMITS.webImages).optional(),
  followUps: z.array(z.string().trim().min(1).max(160)).max(3).optional(),
  summary: z.string().max(8000).optional(),
  /** The validated tool call the message content was built from. */
  toolCall: z
    .strictObject({
      name: chatToolNameSchema,
      arguments: tripCommandPlanSchema,
    })
    .optional(),
});

export const chatStreamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('status'),
    stage: z.enum(['waiting', 'generating']),
  }),
  z.strictObject({
    type: z.literal('text'),
    text: z.string().max(CHAT_LIMITS.messageLength),
  }),
  z.strictObject({ type: z.literal('summary'), text: z.string().max(8000) }),
  z.strictObject({ type: z.literal('complete'), result: chatResponseSchema }),
  z.strictObject({
    type: z.literal('error'),
    code: z.string(),
    message: z.string(),
  }),
]);
