import { z } from 'zod';
import { CHAT_LIMITS } from '../constants/chat.js';
import { tripCommandPlanSchema } from './tripCommandPlan.js';

export const chatRoleSchema = z.enum(['system', 'user', 'assistant']);

export const chatToolNameSchema = z.literal('propose_trip_command_plan');

export const chatMessageSchema = z.strictObject({
  role: chatRoleSchema,
  content: z.string().trim().min(1).max(CHAT_LIMITS.messageLength),
});

export const chatRequestSchema = z.strictObject({
  messages: z.array(chatMessageSchema).min(1).max(CHAT_LIMITS.messages),
  model: z.string().trim().min(1).optional(),
  /** Tools the model may call. Absent means a plain text chat. */
  tools: z.array(chatToolNameSchema).max(1).optional(),
});

export const chatResponseSchema = z.strictObject({
  model: z.string().trim().min(1),
  message: chatMessageSchema.extend({ role: z.literal('assistant') }),
  /** The validated tool call the message content was built from. */
  toolCall: z
    .strictObject({
      name: chatToolNameSchema,
      arguments: tripCommandPlanSchema,
    })
    .optional(),
});
