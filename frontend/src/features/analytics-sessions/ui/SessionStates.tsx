import type { AnalyticsEvent, AnalyticsSessionSummary } from '@trasolve/shared';
import type { PaginatedAnalyticsState } from '@/features/analytics-sessions/model/usePaginatedAnalytics';
import { type AnalyticsSessionsExplorerLabels } from '@/features/analytics-sessions/ui/analyticsSessionTypes';
import {
  MetadataSummary,
  PaginationControl,
  ErrorState,
  getIdentityLabel,
  shortenSessionId,
  formatDateTime,
} from '@/features/analytics-sessions/ui/SessionPresentation';

export function SessionListState({
  state,
  labels,
  selectedSessionId,
  onSelect,
  onReload,
  onLoadMore,
}: {
  state: PaginatedAnalyticsState<AnalyticsSessionSummary>;
  labels: AnalyticsSessionsExplorerLabels;
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onReload: () => void;
  onLoadMore: () => void;
}) {
  if (state.status === 'loading') {
    return <p className="analytics-session-state">{labels.loading}</p>;
  }
  if (state.status === 'error') {
    return <ErrorState labels={labels} onRetry={onReload} />;
  }
  if (state.items.length === 0) {
    return <p className="analytics-session-state">{labels.emptySessions}</p>;
  }
  return (
    <>
      <ul>
        {state.items.map((session) => (
          <li key={session.sessionId}>
            <button
              type="button"
              className={
                selectedSessionId === session.sessionId ? 'is-selected' : ''
              }
              title={session.sessionId}
              aria-label={`${labels.selectSession}: ${session.sessionId}`}
              onClick={() => onSelect(session.sessionId)}
            >
              <span className="analytics-session-list-heading">
                <code>
                  {labels.sessionId}: {shortenSessionId(session.sessionId)}
                </code>
                <strong>
                  {labels.eventCount}: {session.eventCount}
                </strong>
              </span>
              <span>
                {labels.startedAt}: {formatDateTime(session.startedAt)}
              </span>
              <span>
                {labels.endedAt}: {formatDateTime(session.endedAt)}
              </span>
              <span className="analytics-session-list-metrics">
                <span>
                  {labels.pathLength}: {session.pathLength}
                </span>
                <span>
                  {labels.user}: {getIdentityLabel(session, labels)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <PaginationControl
        state={state}
        labels={labels}
        onLoadMore={onLoadMore}
      />
    </>
  );
}

export function TimelineState({
  state,
  labels,
  onReload,
  onLoadMore,
}: {
  state: PaginatedAnalyticsState<AnalyticsEvent>;
  labels: AnalyticsSessionsExplorerLabels;
  onReload: () => void;
  onLoadMore: () => void;
}) {
  if (state.status === 'loading') {
    return <p className="analytics-session-state">{labels.loading}</p>;
  }
  if (state.status === 'error') {
    return <ErrorState labels={labels} onRetry={onReload} />;
  }
  if (state.items.length === 0) {
    return <p className="analytics-session-state">{labels.emptySessions}</p>;
  }
  return (
    <>
      <ol className="analytics-event-timeline">
        {state.items.map((event) => (
          <li key={event.id}>
            <article>
              <header>
                <time dateTime={event.timestamp}>
                  <span>{labels.timestamp}: </span>
                  {formatDateTime(event.timestamp)}
                </time>
                <strong>
                  {labels.eventType}: {event.eventType}
                </strong>
              </header>
              <dl>
                <div>
                  <dt>{labels.screen}</dt>
                  <dd>{event.screen}</dd>
                </div>
                <div>
                  <dt>{labels.target}</dt>
                  <dd>{event.target ?? labels.noTarget}</dd>
                </div>
                <div>
                  <dt>{labels.metadata}</dt>
                  <dd>
                    <MetadataSummary
                      metadata={event.metadata}
                      labels={labels}
                    />
                  </dd>
                </div>
              </dl>
            </article>
          </li>
        ))}
      </ol>
      <PaginationControl
        state={state}
        labels={labels}
        onLoadMore={onLoadMore}
      />
    </>
  );
}
