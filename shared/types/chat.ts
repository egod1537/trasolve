import type { z } from 'zod';
import type {
  chatRoleSchema,
  chatMessageSchema,
  chatRequestSchema,
  chatResponseSchema,
} from '../schemas/chat.js';

export type ChatRole = z.infer<typeof chatRoleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
