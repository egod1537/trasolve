import type { ChatRequest, ChatResponse } from '@trasolve/shared';

export interface ChatProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
}
