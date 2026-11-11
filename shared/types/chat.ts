import type { z } from 'zod';
import type {
  chatRoleSchema,
  chatMessageSchema,
  chatRequestSchema,
  chatResponseSchema,
  chatStreamEventSchema,
  chatWebImageSchema,
} from '../schemas/chat.js';

export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;
export type ChatWebImage = z.infer<typeof chatWebImageSchema>;
