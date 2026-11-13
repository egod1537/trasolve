import type { ReactNode } from 'react';
import { ChatMarkdown } from './ChatMarkdown';

export function ChatAssistantBody({
  content,
  context,
  renderActions,
}: {
  content: string;
  context?: string;
  renderActions?: (content: string, context?: string) => ReactNode;
}) {
  return (
    renderActions?.(content, context) ?? <ChatMarkdown content={content} />
  );
}
