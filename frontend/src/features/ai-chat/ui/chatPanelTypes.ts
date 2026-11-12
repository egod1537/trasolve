import type { ReactNode } from 'react';
import type { ChatSessionOptions } from '../model/chatTypes';

export type Props = ChatSessionOptions & {
  modal?: boolean;
  singleSession?: boolean;
  renderAssistantActions?: (content: string, context?: string) => ReactNode;
  /** Always visible above the messages, independent of any message. */
  notice?: ReactNode;
  onClose?: () => void;
};
