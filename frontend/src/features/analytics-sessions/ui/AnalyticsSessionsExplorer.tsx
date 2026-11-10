import { useMemo, useState, type FormEvent } from 'react';
import {
  useAnalyticsSessionEvents,
  useAnalyticsSessionList,
  type AnalyticsSessionPeriod,
} from '@/features/analytics-sessions/model/useAnalyticsSessions';
import '@/features/analytics-sessions/ui/analytics-sessions.css';
import { type AnalyticsSessionsExplorerLabels } from '@/features/analytics-sessions/ui/analyticsSessionTypes';
import {
  SessionListState,
  TimelineState,
} from '@/features/analytics-sessions/ui/SessionStates';
import {
  createInitialPeriod,
  localDateTimeToIso,
} from '@/features/analytics-sessions/ui/sessionPeriod';
export { type AnalyticsSessionsExplorerLabels } from '@/features/analytics-sessions/ui/analyticsSessionTypes';

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
