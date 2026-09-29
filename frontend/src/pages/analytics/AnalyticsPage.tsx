import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import type { AnalyticsOverviewResponse } from '@trasolve/shared';
import type { AnalyticsFlowExplorerLabels } from '@/features/analytics-flow';
import type { AnalyticsSessionsExplorerLabels } from '@/features/analytics-sessions';
import { getAnalyticsOverview } from '@/shared/api/analytics';
import { getLanguage, useL, type Localize } from '@/shared/i18n';
import './analytics-page.css';

type AnalyticsTab = 'overview' | 'flow' | 'funnels' | 'sessions';

type AnalyticsPeriod = {
  from?: string;
  to?: string;
};

type OverviewState =
  | { status: 'loading' }
  | { status: 'ready'; data: AnalyticsOverviewResponse }
  | { status: 'error' };

const loadingOverviewState: OverviewState = { status: 'loading' };

const AnalyticsFlowExplorer = lazy(() =>
  import('@/features/analytics-flow').then((module) => ({
    default: module.AnalyticsFlowExplorer,
  })),
);
const AnalyticsFunnelExplorer = lazy(() =>
  import('@/features/analytics-funnels').then((module) => ({
    default: module.AnalyticsFunnelExplorer,
  })),
);
const AnalyticsSessionsExplorer = lazy(() =>
  import('@/features/analytics-sessions').then((module) => ({
    default: module.AnalyticsSessionsExplorer,
  })),
);

export default function AnalyticsPage() {
  const L = useL();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const initialRange = useMemo(() => createInitialRange(), []);
  const [draftRange, setDraftRange] = useState(initialRange);
  const [range, setRange] = useState(initialRange);
  const period = useMemo<AnalyticsPeriod>(
    () => ({
      from: localDateTimeToIso(range.from),
      to: localDateTimeToIso(range.to),
    }),
    [range],
  );
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handlePeriodSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setRange(draftRange);
  };

  return (
    <main className="analytics-page">
      <header className="analytics-page-header">
        <div>
          <p>{L('analytics:page.eyebrow.internalTool')}</p>
          <h1>{L('analytics:page.title.analytics')}</h1>
          <span>{L('analytics:page.description.userFlowAnalysis')}</span>
        </div>
        <form className="analytics-page-period" onSubmit={handlePeriodSubmit}>
          <label>
            <span>{L('analytics:period.from')}</span>
            <input
              type="datetime-local"
              value={draftRange.from}
              max={draftRange.to}
              onChange={(event) =>
                setDraftRange((current) => ({
                  ...current,
                  from: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>{L('analytics:period.to')}</span>
            <input
              type="datetime-local"
              value={draftRange.to}
              min={draftRange.from}
              onChange={(event) =>
                setDraftRange((current) => ({
                  ...current,
                  to: event.target.value,
                }))
              }
            />
          </label>
          <button type="submit">{L('analytics:period.apply')}</button>
          <small>
            {L('analytics:period.timezone')}: {timezone}
          </small>
        </form>
      </header>

      <nav
        className="analytics-page-tabs"
        aria-label={L('analytics:page.navigation.analyticsSections')}
        role="tablist"
      >
        <TabButton
          tab="overview"
          activeTab={activeTab}
          label={L('analytics:page.tab.overview')}
          onSelect={setActiveTab}
        />
        <TabButton
          tab="flow"
          activeTab={activeTab}
          label={L('analytics:page.tab.flowGraph')}
          onSelect={setActiveTab}
        />
        <TabButton
          tab="funnels"
          activeTab={activeTab}
          label={L('analytics:page.tab.funnels')}
          onSelect={setActiveTab}
        />
        <TabButton
          tab="sessions"
          activeTab={activeTab}
          label={L('analytics:page.tab.sessions')}
          onSelect={setActiveTab}
        />
      </nav>

      <section
        id={`analytics-panel-${activeTab}`}
        className="analytics-page-panel"
        role="tabpanel"
        aria-labelledby={`analytics-tab-${activeTab}`}
      >
        <Suspense
          fallback={
            <p className="analytics-page-status" role="status">
              {L('analytics:status.loading')}
            </p>
          }
        >
          {activeTab === 'overview' ? <OverviewPanel period={period} /> : null}
          {activeTab === 'flow' ? (
            <AnalyticsFlowExplorer
              labels={createFlowLabels(L)}
              period={period}
            />
          ) : null}
          {activeTab === 'funnels' ? (
            <AnalyticsFunnelExplorer period={period} />
          ) : null}
          {activeTab === 'sessions' ? (
            <AnalyticsSessionsExplorer
              labels={createSessionLabels(L)}
              period={period}
            />
          ) : null}
        </Suspense>
      </section>
    </main>
  );
}

function TabButton({
  tab,
  activeTab,
  label,
  onSelect,
}: {
  tab: AnalyticsTab;
  activeTab: AnalyticsTab;
  label: string;
  onSelect: (tab: AnalyticsTab) => void;
}) {
  const selected = tab === activeTab;
  return (
    <button
      id={`analytics-tab-${tab}`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`analytics-panel-${tab}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => onSelect(tab)}
    >
      {label}
    </button>
  );
}

function OverviewPanel({ period }: { period: AnalyticsPeriod }) {
  const L = useL();
  const locale = getLanguage();
  const { state, reload } = useAnalyticsOverview(period);

  if (state.status === 'loading') {
    return (
      <p className="analytics-page-status" role="status">
        {L('analytics:status.loading')}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="analytics-page-status" role="alert">
        <p>{L('analytics:status.loadError')}</p>
        <button type="button" onClick={reload}>
          {L('common:action.retry')}
        </button>
      </div>
    );
  }
  if (state.data.summary.events === 0) {
    return (
      <p className="analytics-page-status">
        {L('analytics:overview.status.noData')}
      </p>
    );
  }

  const finalTransition = state.data.funnel.transitions.at(-1);
  const largestDropOff = state.data.funnel.transitions.reduce(
    (largest, transition) =>
      largest === undefined ||
      transition.dropOffSessions > largest.dropOffSessions
        ? transition
        : largest,
    undefined as
      AnalyticsOverviewResponse['funnel']['transitions'][number] | undefined,
  );
  return (
    <dl className="analytics-overview-grid">
      <OverviewKpi
        label={L('analytics:metric.sessions')}
        value={formatNumber(state.data.summary.sessions, locale)}
      />
      <OverviewKpi
        label={L('analytics:metric.events')}
        value={formatNumber(state.data.summary.events, locale)}
      />
      <OverviewKpi
        label={L('analytics:metric.averagePathLength')}
        value={formatDecimal(state.data.summary.avgPathLength, locale)}
      />
      <OverviewKpi
        label={L('analytics:metric.conversion')}
        value={formatPercent(finalTransition?.conversionRate ?? 0, locale)}
      />
      <OverviewKpi
        label={L('analytics:metric.dropOff')}
        value={formatPercent(largestDropOff?.dropOffRate ?? 0, locale)}
      />
      <OverviewKpi
        label={L('analytics:metric.backtrack')}
        value={formatNumber(state.data.summary.backtrackCount, locale)}
      />
    </dl>
  );
}

function OverviewKpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function useAnalyticsOverview(period: AnalyticsPeriod): {
  state: OverviewState;
  reload: () => void;
} {
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: OverviewState }>({
    key: '',
    state: loadingOverviewState,
  });
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const { from, to } = period;
  const key = `${from ?? ''}|${to ?? ''}|${version}`;

  useEffect(() => {
    const controller = new AbortController();
    void getAnalyticsOverview({ from, to }, { signal: controller.signal })
      .then((data) => setLoaded({ key, state: { status: 'ready', data } }))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') {
          return;
        }
        setLoaded({ key, state: { status: 'error' } });
      });
    return () => controller.abort();
  }, [from, key, to]);

  return {
    state: loaded.key === key ? loaded.state : loadingOverviewState,
    reload,
  };
}

function createFlowLabels(L: Localize): AnalyticsFlowExplorerLabels {
  return {
    graph: L('analytics:flow.graph'),
    filters: L('analytics:flow.filters'),
    from: L('analytics:period.from'),
    to: L('analytics:period.to'),
    timezone: L('analytics:period.timezone'),
    minimumCount: L('analytics:flow.minimumCount'),
    nodeMode: L('analytics:flow.nodeMode'),
    mixedMode: L('analytics:flow.mode.mixed'),
    screenMode: L('analytics:flow.mode.screen'),
    domainEventMode: L('analytics:flow.mode.domainEvent'),
    applyFilters: L('analytics:period.apply'),
    loading: L('analytics:status.loading'),
    error: L('analytics:status.loadError'),
    empty: L('analytics:flow.status.noData'),
    retry: L('common:action.retry'),
    details: L('analytics:flow.details'),
    visits: L('analytics:metric.visits'),
    sessions: L('analytics:metric.sessions'),
    count: L('analytics:metric.count'),
    ratio: L('analytics:metric.ratio'),
    source: L('analytics:metric.source'),
    target: L('analytics:metric.target'),
  };
}

function createSessionLabels(L: Localize): AnalyticsSessionsExplorerLabels {
  return {
    filters: L('analytics:sessions.filters'),
    from: L('analytics:period.from'),
    to: L('analytics:period.to'),
    timezone: L('analytics:period.timezone'),
    applyFilters: L('analytics:period.apply'),
    sessions: L('analytics:page.tab.sessions'),
    timeline: L('analytics:sessions.timeline'),
    loading: L('analytics:status.loading'),
    error: L('analytics:status.loadError'),
    retry: L('common:action.retry'),
    emptySessions: L('analytics:sessions.status.noData'),
    selectSession: L('analytics:sessions.status.selectSession'),
    loadMore: L('analytics:sessions.action.loadMore'),
    loadingMore: L('analytics:sessions.status.loadingMore'),
    sessionId: L('analytics:sessions.metric.sessionId'),
    startedAt: L('analytics:sessions.metric.startedAt'),
    endedAt: L('analytics:sessions.metric.endedAt'),
    eventCount: L('analytics:sessions.metric.eventCount'),
    user: L('analytics:sessions.metric.user'),
    authenticated: L('analytics:sessions.identity.authenticated'),
    anonymous: L('analytics:sessions.identity.anonymous'),
    mixedIdentity: L('analytics:sessions.identity.mixed'),
    pathLength: L('analytics:metric.pathLength'),
    timestamp: L('analytics:sessions.metric.timestamp'),
    eventType: L('analytics:sessions.metric.eventType'),
    screen: L('analytics:sessions.metric.screen'),
    target: L('analytics:metric.target'),
    noTarget: L('analytics:sessions.value.noTarget'),
    metadata: L('analytics:sessions.metric.metadata'),
    noMetadata: L('analytics:sessions.value.noMetadata'),
    metadataDetails: L('analytics:sessions.metadata.details'),
  };
}

function createInitialRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86_400_000);
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

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

function formatDecimal(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}
