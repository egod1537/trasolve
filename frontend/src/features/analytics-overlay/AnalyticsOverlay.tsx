import { useEffect, useState } from 'react';
import type { AnalyticsOverviewResponse } from '@trasolve/shared';
import { getAnalyticsOverview } from '@/shared/api/analytics';
import { NL, useL } from '@/shared/i18n';
import { AnalyticsTargetAnnotations } from './AnalyticsTargetAnnotations';
import './analytics-overlay.css';

type OverlayState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: AnalyticsOverviewResponse };

type KeyedOverlayState = {
  requestKey: string;
  state: OverlayState;
};

export function AnalyticsOverlay() {
  const L = useL();
  const [rangeHours, setRangeHours] = useState<1 | 24 | 168>(24);
  const [requestVersion, setRequestVersion] = useState(0);
  const requestKey = `${rangeHours}:${requestVersion}`;
  const [loaded, setLoaded] = useState<KeyedOverlayState>({
    requestKey: '',
    state: { status: 'loading' },
  });
  const state =
    loaded.requestKey === requestKey
      ? loaded.state
      : ({ status: 'loading' } satisfies OverlayState);

  useEffect(() => {
    const controller = new AbortController();
    const to = new Date();
    const from = new Date(to.getTime() - rangeHours * 60 * 60 * 1000);
    void getAnalyticsOverview(
      { from: from.toISOString(), to: to.toISOString() },
      { signal: controller.signal },
    )
      .then((data) => {
        setLoaded({ requestKey, state: { status: 'ready', data } });
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        setLoaded({ requestKey, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [rangeHours, requestKey]);

  return (
    <>
      <aside className="analytics-map-overlay" data-analytics-overlay="true">
        <div className="analytics-map-overlay-toolbar">
          <code>{NL('?analytics=1')}</code>
          <div className="analytics-map-overlay-ranges">
            <button
              type="button"
              aria-pressed={rangeHours === 1}
              onClick={() => setRangeHours(1)}
            >
              {NL('1h')}
            </button>
            <button
              type="button"
              aria-pressed={rangeHours === 24}
              onClick={() => setRangeHours(24)}
            >
              {NL('24h')}
            </button>
            <button
              type="button"
              aria-pressed={rangeHours === 168}
              onClick={() => setRangeHours(168)}
            >
              {NL('7d')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRequestVersion((current) => current + 1)}
          >
            {L('common:action.refresh')}
          </button>
        </div>
        {state.status === 'loading' ? (
          <p role="status">{L('common:routes.loadingLabel.pageLoading')}</p>
        ) : null}
        {state.status === 'error' ? (
          <p role="alert">{L('common:status.error')}</p>
        ) : null}
        {state.status === 'ready' ? <OverlayMetrics data={state.data} /> : null}
      </aside>
      {state.status === 'ready' ? (
        <AnalyticsTargetAnnotations targets={state.data.targets} />
      ) : null}
    </>
  );
}

function OverlayMetrics({ data }: { data: AnalyticsOverviewResponse }) {
  return (
    <div className="analytics-map-overlay-content">
      <dl className="analytics-map-overlay-summary">
        {Object.entries(data.summary).map(([identifier, value]) => (
          <div key={identifier}>
            <dt>
              <code>{identifier}</code>
            </dt>
            <dd>{formatMetric(value)}</dd>
          </div>
        ))}
      </dl>
      <ol className="analytics-map-overlay-funnel">
        {data.funnel.transitions.map((transition) => (
          <li key={`${transition.source}:${transition.target}`}>
            <div>
              <code>{transition.source}</code>
              <span aria-hidden="true">→</span>
              <code>{transition.target}</code>
            </div>
            <dl>
              {Object.entries(transition)
                .filter(
                  ([identifier]) =>
                    identifier !== 'source' && identifier !== 'target',
                )
                .map(([identifier, value]) => (
                  <div key={identifier}>
                    <dt>
                      <code>{identifier}</code>
                    </dt>
                    <dd>{formatMetric(value)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatMetric(value: unknown): string {
  if (typeof value !== 'number') {
    return String(value);
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
}
