import { z } from 'zod';
import { CHAT_LIMITS } from '../constants/chat.js';

export const chatRoleSchema = z.enum(['user', 'assistant']);

export const chatMessageSchema = z.strictObject({
  role: chatRoleSchema,
  content: z.string().trim().min(1).max(CHAT_LIMITS.messageLength),
});

export const chatRequestSchema = z.strictObject({
  messages: z.array(chatMessageSchema).min(1).max(CHAT_LIMITS.messages),
});

export const chatResponseSchema = z.strictObject({
  message: chatMessageSchema.extend({ role: z.literal('assistant') }),
});
