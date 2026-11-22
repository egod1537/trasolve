import type { ChatToolProgress } from '@trasolve/shared';
import { NL, useL } from '@/shared/i18n';
import { ChatMarkdown } from '../ChatMarkdown';

const noTools: readonly ChatToolProgress[] = [];

export function ChatV2Progress({
  summary,
  tools = noTools,
  busy = false,
  stage,
}: {
  summary?: string;
  tools?: readonly ChatToolProgress[];
  busy?: boolean;
  stage?: 'waiting' | 'generating';
}) {
  const L = useL();
  const title = !busy
    ? L('analytics:flow.details')
    : stage === 'waiting'
      ? L('common:jobs.jOBSTATUSLABELS.text.waiting')
      : stage === 'generating'
        ? L('ai:mapAiPanel.renderThread.ariaLabel.generatingAiResponse')
        : L('ai:mapAiPanel.action.creating');
  const indicator = (
    <span className="chat-v2-progress-indicator" aria-hidden="true" />
  );
  if (!summary?.trim() && !tools.length) {
    return busy ? (
      <p
        className="chat-v2-progress chat-v2-progress-status is-busy"
        role="status"
      >
        {indicator}
        {title}
      </p>
    ) : null;
  }
  return (
    <details
      className={`chat-v2-progress${busy ? ' is-busy' : ''}`}
      open={busy}
    >
      <summary>
        {indicator}
        <span role={busy ? 'status' : undefined}>{title}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m8 10 4 4 4-4" />
        </svg>
      </summary>
      <div className="chat-v2-progress-content">
        {tools.length > 0 && (
          <ul className="chat-v2-progress-tools" role="list">
            {tools.map(({ tool, index, status }) => (
              <li key={`${tool}:${index}`}>
                <code>
                  {tool === 'web_search'
                    ? NL('web_search')
                    : NL('propose_trip_command_plan')}
                </code>
                <span>
                  {status === 'running'
                    ? L('common:jobs.jOBSTATUSLABELS.text.running')
                    : status === 'completed'
                      ? L('common:jobs.jOBSTATUSLABELS.text.done')
                      : L('common:status.error')}
                </span>
              </li>
            ))}
          </ul>
        )}
        {summary?.trim() && <ChatMarkdown content={summary} />}
      </div>
    </details>
  );
}
