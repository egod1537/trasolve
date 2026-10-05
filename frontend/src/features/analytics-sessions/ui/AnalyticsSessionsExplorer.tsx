import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type {
  AnalyticsEvent,
  AnalyticsEventMetadata,
  AnalyticsSessionSummary,
} from '@trasolve/shared';
import {
  useAnalyticsSessionEvents,
  useAnalyticsSessionList,
  type AnalyticsSessionPeriod,
} from '../model/useAnalyticsSessions';
import type { PaginatedAnalyticsState } from '../model/usePaginatedAnalytics';
import './analytics-sessions.css';

export type AnalyticsSessionsExplorerLabels = {
  filters: string;
  from: string;
  to: string;
  timezone: string;
  applyFilters: string;
  sessions: string;
  timeline: string;
  loading: string;
  error: string;
  retry: string;
  emptySessions: string;
  selectSession: string;
  loadMore: string;
  loadingMore: string;
  sessionId: string;
  startedAt: string;
  endedAt: string;
  eventCount: string;
  user: string;
  authenticated: string;
  anonymous: string;
  mixedIdentity: string;
  pathLength: string;
  timestamp: string;
  eventType: string;
  screen: string;
  target: string;
  noTarget: string;
  metadata: string;
  noMetadata: string;
  metadataDetails: string;
};

type LocalPeriod = {
  from: string;
  to: string;
};

export function AnalyticsSessionsExplorer({
  labels,
  initialRange,
  period: sharedPeriod,
}: {
  labels: AnalyticsSessionsExplorerLabels;
  initialRange?: { from: Date; to: Date };
  period?: AnalyticsSessionPeriod;
}) {
  const initialPeriod = useMemo(
    () => createInitialPeriod(initialRange),
    [initialRange],
  );
  const [draftPeriod, setDraftPeriod] = useState(initialPeriod);
  const [localPeriod, setLocalPeriod] = useState(initialPeriod);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const period = useMemo<AnalyticsSessionPeriod>(
    () =>
      sharedPeriod ?? {
        from: localDateTimeToIso(localPeriod.from),
        to: localDateTimeToIso(localPeriod.to),
      },
    [localPeriod, sharedPeriod],
  );
  const sessions = useAnalyticsSessionList(period);
  const events = useAnalyticsSessionEvents(selectedSessionId, period);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSelectedSessionId(null);
    setLocalPeriod(draftPeriod);
  };

  return (
    <section className="analytics-sessions-explorer">
      {sharedPeriod === undefined ? (
        <form className="analytics-session-filters" onSubmit={handleSubmit}>
          <h2>{labels.filters}</h2>
          <div className="analytics-session-filter-fields">
            <label>
              <span>{labels.from}</span>
              <input
                type="datetime-local"
                value={draftPeriod.from}
                max={draftPeriod.to}
                onChange={(event) =>
                  setDraftPeriod((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>{labels.to}</span>
              <input
                type="datetime-local"
                value={draftPeriod.to}
                min={draftPeriod.from}
                onChange={(event) =>
                  setDraftPeriod((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </label>
          </div>
          <div className="analytics-session-filter-footer">
            <span>
              {labels.timezone}: {timezone}
            </span>
            <button type="submit">{labels.applyFilters}</button>
          </div>
        </form>
      ) : null}

      <div className="analytics-session-browser">
        <section
          className="analytics-session-list"
          aria-label={labels.sessions}
        >
          <h2>{labels.sessions}</h2>
          <SessionListState
            state={sessions.state}
            labels={labels}
            selectedSessionId={selectedSessionId}
            onSelect={setSelectedSessionId}
            onReload={sessions.reload}
            onLoadMore={sessions.loadMore}
          />
        </section>

        <section
          className="analytics-session-timeline"
          aria-label={labels.timeline}
        >
          <h2>{labels.timeline}</h2>
          {selectedSessionId === null ? (
            <p className="analytics-session-state">{labels.selectSession}</p>
          ) : (
            <TimelineState
              state={events.state}
              labels={labels}
              onReload={events.reload}
              onLoadMore={events.loadMore}
            />
          )}
        </section>
      </div>
    </section>
  );
}

function SessionListState({
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

function TimelineState({
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

function MetadataSummary({
  metadata,
  labels,
}: {
  metadata: AnalyticsEventMetadata | null;
  labels: AnalyticsSessionsExplorerLabels;
}) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span>{labels.noMetadata}</span>;
  }
  return (
    <div className="analytics-event-metadata">
      <div className="analytics-event-metadata-compact">
        {Object.entries(metadata)
          .slice(0, 4)
          .map(([key, value]) => (
            <span key={key}>
              <strong>{key}</strong>={formatMetadataValue(value)}
            </span>
          ))}
      </div>
      <details>
        <summary>{labels.metadataDetails}</summary>
        <pre>{JSON.stringify(metadata, null, 2)}</pre>
      </details>
    </div>
  );
}

function PaginationControl<Item>({
  state,
  labels,
  onLoadMore,
}: {
  state: Extract<PaginatedAnalyticsState<Item>, { status: 'ready' }>;
  labels: AnalyticsSessionsExplorerLabels;
  onLoadMore: () => void;
}) {
  if (state.nextCursor === null) {
    return null;
  }
  return (
    <div className="analytics-session-pagination">
      {state.loadMoreStatus === 'error' ? (
        <span role="alert">{labels.error}</span>
      ) : null}
      <button
        type="button"
        disabled={state.loadMoreStatus === 'loading'}
        onClick={onLoadMore}
      >
        {state.loadMoreStatus === 'loading'
          ? labels.loadingMore
          : state.loadMoreStatus === 'error'
            ? labels.retry
            : labels.loadMore}
      </button>
    </div>
  );
}

function ErrorState({
  labels,
  onRetry,
}: {
  labels: AnalyticsSessionsExplorerLabels;
  onRetry: () => void;
}) {
  return (
    <div className="analytics-session-state" role="alert">
      <p>{labels.error}</p>
      <button type="button" onClick={onRetry}>
        {labels.retry}
      </button>
    </div>
  );
}

function getIdentityLabel(
  session: AnalyticsSessionSummary,
  labels: AnalyticsSessionsExplorerLabels,
): string {
  if (session.userIds.length > 0 && session.hasAnonymousEvents) {
    return labels.mixedIdentity;
  }
  return session.userIds.length > 0 ? labels.authenticated : labels.anonymous;
}

function shortenSessionId(sessionId: string): string {
  return sessionId.length <= 16
    ? sessionId
    : `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp));
}

function formatMetadataValue(value: unknown): ReactNode {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean' || value === null) {
    return JSON.stringify(value);
  }
  const serialized = JSON.stringify(value);
  return serialized.length > 80 ? `${serialized.slice(0, 77)}…` : serialized;
}

function createInitialPeriod(initialRange?: {
  from: Date;
  to: Date;
}): LocalPeriod {
  const to = initialRange?.to ?? new Date();
  const from = initialRange?.from ?? new Date(to.getTime() - 7 * 86_400_000);
  return { from: toLocalDateTimeInput(from), to: toLocalDateTimeInput(to) };
}

function toLocalDateTimeInput(value: Date): string {
  const offsetMilliseconds = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMilliseconds)
    .toISOString()
    .slice(0, 16);
}

function localDateTimeToIso(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
