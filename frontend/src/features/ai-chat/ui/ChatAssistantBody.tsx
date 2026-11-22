import type { ReactNode } from 'react';
import type { ChatResponse } from '@trasolve/shared';
import { ChatMarkdown } from './ChatMarkdown';

export function ChatAssistantBody({
  content,
  context,
  placeRecommendations,
  renderActions,
}: {
  content: string;
  context?: string;
  placeRecommendations?: ChatResponse['placeRecommendations'];
  renderActions?: (content: string, context?: string) => ReactNode;
}) {
  const actions = renderActions?.(content, context);
  if (actions != null) {
    return actions;
  }
  return (
    <>
      <ChatMarkdown content={content} />
      {placeRecommendations?.length ? (
        <ol className="chat-place-recommendations">
          {placeRecommendations.map(
            ({ id, name, reason, sourceLabel, sourceUrl }) => (
              <li key={id}>
                <strong>{name}</strong>
                <p>{reason}</p>
                <cite>
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    {sourceLabel}
                  </a>
                </cite>
              </li>
            ),
          )}
        </ol>
      ) : null}
    </>
  );
}
