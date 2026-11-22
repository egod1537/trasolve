import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
} from '@trasolve/shared';

export type ChatStreamOptions = {
  destinationKnowledge?: boolean;
  signal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
};

export interface ChatProvider {
  chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
  stream?(
    request: ChatRequest,
    options: ChatStreamOptions,
  ): Promise<ChatResponse>;
}
