import { useL } from '@/shared/i18n';
import { ChatMarkdown } from '../ChatMarkdown';

export function ChatV2Progress({
  summary,
  busy = false,
  waiting = false,
}: {
  summary?: string;
  busy?: boolean;
  waiting?: boolean;
}) {
  const L = useL();
  if (!busy && !summary) {
    return null;
  }
  return (
    <details className={`chat-v2-progress${busy ? ' is-busy' : ''}`}>
      <summary>
        <span className="chat-v2-progress-indicator" aria-hidden="true" />
        <span role={busy ? 'status' : undefined}>
          {busy
            ? waiting
              ? L('common:jobs.jOBSTATUSLABELS.text.waiting')
              : L('ai:mapAiPanel.renderThread.ariaLabel.generatingAiResponse')
            : L('analytics:flow.details')}
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m8 10 4 4 4-4" />
        </svg>
      </summary>
      <div className="chat-v2-progress-content">
        {summary ? (
          <ChatMarkdown content={summary} />
        ) : (
          <p>{L('ai:mapAiPanel.text.iMThinkingAnswer')}</p>
        )}
      </div>
    </details>
  );
}
