import type { ChatMessage } from '@trasolve/shared';

export type ConversationHistoryMessage = ChatMessage & {
  role: 'user' | 'assistant';
};

export type ConversationSession = {
  id: string;
  messages: ConversationHistoryMessage[];
  createdAt: string;
  updatedAt: string;
};

export interface ConversationSessionStore {
  get(conversationId: string): Promise<ConversationSession | null>;
  save(session: ConversationSession): Promise<void>;
  delete(conversationId: string): Promise<void>;
}

export class InMemoryConversationSessionStore implements ConversationSessionStore {
  public async get(
    conversationId: string,
  ): Promise<ConversationSession | null> {
    const session = this.sessions.get(conversationId);
    return session ? structuredClone(session) : null;
  }

  public async save(session: ConversationSession): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  public async delete(conversationId: string): Promise<void> {
    this.sessions.delete(conversationId);
  }

  private readonly sessions = new Map<string, ConversationSession>();
}
