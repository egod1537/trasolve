import type { ChatMessage } from '@trasolve/shared';

export function serializeChatToMarkdown(
  messages: readonly ChatMessage[],
): string {
  const conversation = messages
    .map(
      ({ role, content }) =>
        `## ${role === 'user' ? 'User' : 'Assistant'}\n\n${content.replace(/\r\n?/g, '\n')}`,
    )
    .join('\n\n---\n\n');
  return `# Trasolve AI Chat\n${conversation ? `\n${conversation}\n` : ''}`;
}

export function downloadChatMarkdown(messages: readonly ChatMessage[]): void {
  if (!messages.length) {
    return;
  }
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const blob = new Blob([serializeChatToMarkdown(messages)], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `trasolve-ai-chat-${date}.md`;
  try {
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Release after the browser has started consuming the download URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
