import { type ReactNode } from 'react';
import { type ChatMessage, type ChatRequest } from '@trasolve/shared';

/** Request context is captured with its answer so actions use the original trip snapshot. */
export type ChatRequestPreamble = {
  systemMessages: readonly ChatMessage[];
  context?: string;
  /** Tools the model may call for this request (edit mode only). */
  tools?: ChatRequest['tools'];
};

export type Props = {
  open: boolean;
  modal?: boolean;
  singleSession?: boolean;
  persistenceKey?: string;
  getRequestPreamble?: () => Promise<ChatRequestPreamble>;
  renderAssistantActions?: (content: string, context?: string) => ReactNode;
  /** Always visible above the messages, independent of any message. */
  notice?: ReactNode;
  model?: string;
  onClose?: () => void;
  onGeneratingChange?: (generating: boolean) => void;
  onUnreadPreviewsChange?: (previews: MapAiUnreadPreview[]) => void;
};

export type UiChatMessage = ChatMessage & {
  id: string;
  createdAt: number;
  unread: boolean;
  requestContent?: string | null;
  /** Opaque context captured when the request for this answer was sent. */
  requestContext?: string;
};

export type MapAiUnreadPreview = {
  messageId: string;
  threadId: string;
  threadTitle: string;
  content: string;
  createdAt: number;
};

export type MapAiPanelHandle = {
  viewSelectedThread(): void;
  viewThread(threadId: string): void;
};

export type ChatThread = {
  id: string;
  title: string;
  titleIsDefault: boolean;
  messages: UiChatMessage[];
  updatedAt: number;
  archived: boolean;
  error: string | null;
};

export type PersistedProductChat = {
  messages: UiChatMessage[];
  draft: string;
};
