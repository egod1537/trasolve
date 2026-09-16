import { randomUUID } from 'node:crypto';
import {
  CHAT_LIMITS,
  chatMessageSchema,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
} from '@trasolve/shared';
import type { ChatService } from '../chatService.js';
import {
  type ConversationContextSource,
  type ConversationContextStore,
  ConversationContextComposer,
} from './conversationContext.js';
import type {
  ConversationHistoryMessage,
  ConversationSession,
  ConversationSessionStore,
} from './conversationSessionStore.js';

const conversationIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;

export type ConversationTurnOptions = Omit<ChatRequest, 'messages'>;

export class ConversationContextBudgetError extends Error {
  public constructor() {
    super('Conversation context exceeds the chat message limit.');
    this.name = 'ConversationContextBudgetError';
  }
}

export class ConversationService {
  public constructor(
    private readonly chatService: ChatService,
    private readonly sessions: ConversationSessionStore,
    private readonly contexts: ConversationContextStore,
    private readonly contextComposer: ConversationContextComposer,
  ) {}

  public async createConversation(
    conversationId = randomUUID(),
  ): Promise<ConversationSession> {
    this.validateConversationId(conversationId);
    return this.serialize(conversationId, async () => {
      const existing = await this.sessions.get(conversationId);
      if (existing) {
        return existing;
      }
      const session = this.newSession(conversationId);
      await this.sessions.save(session);
      return session;
    });
  }

  public async getConversation(
    conversationId: string,
  ): Promise<ConversationSession | null> {
    this.validateConversationId(conversationId);
    return this.sessions.get(conversationId);
  }

  public async setContext<T>(
    conversationId: string,
    source: ConversationContextSource<T>,
    value: T,
  ): Promise<void> {
    this.validateConversationId(conversationId);
    await this.serialize(conversationId, async () => {
      await this.ensureSession(conversationId);
      this.contextComposer.registerSource(source);
      await this.contexts.set(conversationId, source.category, value);
    });
  }

  public async removeContext(
    conversationId: string,
    category: string,
  ): Promise<void> {
    this.validateConversationId(conversationId);
    await this.serialize(conversationId, async () => {
      await this.contexts.delete(conversationId, category);
    });
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    this.validateConversationId(conversationId);
    await this.serialize(conversationId, async () => {
      await this.sessions.delete(conversationId);
      await this.contexts.deleteAll(conversationId);
    });
  }

  public async sendMessage(
    conversationId: string,
    content: string,
    options: ConversationTurnOptions = {},
  ): Promise<ChatResponse> {
    this.validateConversationId(conversationId);
    const parsed = chatMessageSchema.safeParse({ role: 'user', content });
    if (!parsed.success) {
      throw new Error('Invalid conversation message.');
    }
    const userMessage: ConversationHistoryMessage = {
      role: 'user',
      content: parsed.data.content,
    };
    return this.serialize(conversationId, async () => {
      const session =
        (await this.sessions.get(conversationId)) ??
        this.newSession(conversationId);
      const contextMessages = this.contextComposer.compose(
        await this.contexts.get(conversationId),
      );
      const request: ChatRequest = {
        ...options,
        messages: this.composeRequestMessages(
          contextMessages,
          session.messages,
          userMessage,
        ),
      };
      const response = await this.chatService.chat(request);
      const now = new Date().toISOString();
      const messages: ConversationHistoryMessage[] = [
        ...session.messages,
        userMessage,
        response.message,
      ];
      await this.sessions.save({ ...session, messages, updatedAt: now });
      return response;
    });
  }

  private readonly operations = new Map<string, Promise<unknown>>();

  private composeRequestMessages(
    context: ChatMessage[],
    history: readonly ConversationHistoryMessage[],
    userMessage: ConversationHistoryMessage,
  ): ChatMessage[] {
    const available = CHAT_LIMITS.messages - context.length - 1;
    const historyLimit = available - (available % 2);
    if (historyLimit < 0) {
      throw new ConversationContextBudgetError();
    }
    this.assertCompleteTurns(history);
    const retainedHistory =
      historyLimit === 0 ? [] : history.slice(-historyLimit);
    return [...context, ...retainedHistory, userMessage];
  }

  private assertCompleteTurns(
    history: readonly ConversationHistoryMessage[],
  ): void {
    if (history.length % 2 !== 0) {
      throw new Error('Conversation history contains an incomplete turn.');
    }
    for (let index = 0; index < history.length; index += 2) {
      if (
        history[index]?.role !== 'user' ||
        history[index + 1]?.role !== 'assistant'
      ) {
        throw new Error('Conversation history contains an invalid turn.');
      }
    }
  }

  private async ensureSession(
    conversationId: string,
  ): Promise<ConversationSession> {
    const existing = await this.sessions.get(conversationId);
    if (existing) {
      return existing;
    }
    const session = this.newSession(conversationId);
    await this.sessions.save(session);
    return session;
  }

  private newSession(conversationId: string): ConversationSession {
    const now = new Date().toISOString();
    return {
      id: conversationId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  private async serialize<T>(
    conversationId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const current = (this.operations.get(conversationId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(operation);
    this.operations.set(conversationId, current);
    try {
      return await current;
    } finally {
      if (this.operations.get(conversationId) === current) {
        this.operations.delete(conversationId);
      }
    }
  }

  private validateConversationId(conversationId: string): void {
    if (!conversationIdPattern.test(conversationId)) {
      throw new Error('Invalid conversation ID.');
    }
  }
}
