import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type {
  AnalyticsFlowNodeMode,
  AnalyticsFlowResponse,
} from '@trasolve/shared';
import { useAnalyticsFlow } from '../model/useAnalyticsFlow';
import {
  DirectedFlowGraph,
  type AnalyticsFlowSelection,
} from './DirectedFlowGraph';
import './analytics-flow.css';

export type AnalyticsFlowExplorerLabels = {
  graph: string;
  filters: string;
  from: string;
  to: string;
  timezone: string;
  minimumCount: string;
  nodeMode: string;
  mixedMode: string;
  screenMode: string;
  domainEventMode: string;
  applyFilters: string;
  loading: string;
  error: string;
  empty: string;
  retry: string;
  details: string;
  visits: string;
  sessions: string;
  count: string;
  ratio: string;
  source: string;
  target: string;
};

export type AnalyticsFlowExplorerProps = {
  labels: AnalyticsFlowExplorerLabels;
  getNodeLabel?: (
    identifier: AnalyticsFlowResponse['nodes'][number]['identifier'],
    kind: AnalyticsFlowResponse['nodes'][number]['kind'],
  ) => string;
  initialRange?: {
    from: Date;
    to: Date;
  };
  period?: {
    from?: string;
    to?: string;
  };
};

type FlowFilterState = {
  from: string;
  to: string;
  minimumCount: number;
  nodeMode: AnalyticsFlowNodeMode;
};

export function AnalyticsFlowExplorer({
  labels,
  getNodeLabel = (identifier) => identifier,
  initialRange,
  period,
}: AnalyticsFlowExplorerProps) {
  const initialFilters = useMemo(
    () => createInitialFilters(initialRange),
    [initialRange],
  );
  const [draftFilters, setDraftFilters] =
    useState<FlowFilterState>(initialFilters);
  const [filters, setFilters] = useState<FlowFilterState>(initialFilters);
  const [selection, setSelection] = useState<AnalyticsFlowSelection | null>(
    null,
  );
  const query = useMemo(
    () => ({
      from: period?.from ?? localDateTimeToIso(filters.from),
      to: period?.to ?? localDateTimeToIso(filters.to),
      minimumCount: filters.minimumCount,
      nodeMode: filters.nodeMode,
    }),
    [filters, period?.from, period?.to],
  );
  const { state, reload } = useAnalyticsFlow(query);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatNodeMetrics = useCallback(
    (visits: number, sessions: number) =>
      `${labels.visits}: ${visits} · ${labels.sessions}: ${sessions}`,
    [labels.sessions, labels.visits],
  );
  const formatEdgeMetrics = useCallback(
    (count: number, ratio: number) =>
      `${labels.count}: ${count} · ${labels.ratio}: ${formatRatio(ratio)}`,
    [labels.count, labels.ratio],
  );
  const handleSelectionChange = useCallback(
    (nextSelection: AnalyticsFlowSelection | null) => {
      setSelection(nextSelection);
    },
    [],
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSelection(null);
    setFilters(draftFilters);
  };

  return (
    <section className="analytics-flow-explorer">
      <form className="analytics-flow-filters" onSubmit={handleSubmit}>
        <h2>{labels.filters}</h2>
        <div className="analytics-flow-filter-grid">
          {period === undefined ? (
            <>
              <label>
                <span>{labels.from}</span>
                <input
                  type="datetime-local"
                  value={draftFilters.from}
                  max={draftFilters.to}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
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
                  value={draftFilters.to}
                  min={draftFilters.from}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      to: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : null}
          <label>
            <span>{labels.minimumCount}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={draftFilters.minimumCount}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  minimumCount: Math.max(1, event.target.valueAsNumber || 1),
                }))
              }
            />
          </label>
          <label>
            <span>{labels.nodeMode}</span>
            <select
              value={draftFilters.nodeMode}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  nodeMode: event.target.value as AnalyticsFlowNodeMode,
                }))
              }
            >
              <option value="mixed">{labels.mixedMode}</option>
              <option value="screen">{labels.screenMode}</option>
              <option value="domain_event">{labels.domainEventMode}</option>
            </select>
          </label>
        </div>
        <div className="analytics-flow-filter-footer">
          <span>
            {labels.timezone}: {timezone}
          </span>
          <button type="submit">{labels.applyFilters}</button>
        </div>
      </form>

      <div className="analytics-flow-content">
        <div className="analytics-flow-canvas-shell">
          {state.status === 'loading' ? (
            <p className="analytics-flow-status" role="status">
              {labels.loading}
            </p>
          ) : null}
          {state.status === 'error' ? (
            <div className="analytics-flow-status" role="alert">
              <p>{labels.error}</p>
              <button type="button" onClick={reload}>
                {labels.retry}
              </button>
            </div>
          ) : null}
          {state.status === 'ready' && state.data.nodes.length === 0 ? (
            <p className="analytics-flow-status">{labels.empty}</p>
          ) : null}
          {state.status === 'ready' && state.data.nodes.length > 0 ? (
            <DirectedFlowGraph
              data={state.data}
              accessibleLabel={labels.graph}
              getNodeLabel={getNodeLabel}
              formatNodeMetrics={formatNodeMetrics}
              formatEdgeMetrics={formatEdgeMetrics}
              onSelectionChange={handleSelectionChange}
            />
          ) : null}
        </div>

        <aside className="analytics-flow-details" aria-label={labels.details}>
          <h2>{labels.details}</h2>
          {selection ? (
            <SelectionDetails
              selection={selection}
              labels={labels}
              getNodeLabel={getNodeLabel}
            />
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function SelectionDetails({
  selection,
  labels,
  getNodeLabel,
}: {
  selection: AnalyticsFlowSelection;
  labels: AnalyticsFlowExplorerLabels;
  getNodeLabel: NonNullable<AnalyticsFlowExplorerProps['getNodeLabel']>;
}) {
  if (selection.kind === 'node') {
    const node = selection.value;
    return (
      <dl>
        <div>
          <dt>{labels.nodeMode}</dt>
          <dd>{getNodeLabel(node.identifier, node.kind)}</dd>
        </div>
        <div>
          <dt>{labels.visits}</dt>
          <dd>{node.visits}</dd>
        </div>
        <div>
          <dt>{labels.sessions}</dt>
          <dd>{node.sessions}</dd>
        </div>
      </dl>
    );
  }

  const edge = selection.value;
  return (
    <dl>
      <div>
        <dt>{labels.source}</dt>
        <dd>{edge.source}</dd>
      </div>
      <div>
        <dt>{labels.target}</dt>
        <dd>{edge.target}</dd>
      </div>
      <div>
        <dt>{labels.count}</dt>
        <dd>{edge.count}</dd>
      </div>
      <div>
        <dt>{labels.ratio}</dt>
        <dd>{formatRatio(edge.ratio)}</dd>
      </div>
      <div>
        <dt>{labels.sessions}</dt>
        <dd>{edge.sessions}</dd>
      </div>
    </dl>
  );
}

function createInitialFilters(
  initialRange: AnalyticsFlowExplorerProps['initialRange'],
): FlowFilterState {
  const to = initialRange?.to ?? new Date();
  const from = initialRange?.from ?? new Date(to.getTime() - 7 * 86_400_000);
  return {
    from: toLocalDateTimeInput(from),
    to: toLocalDateTimeInput(to),
    minimumCount: 1,
    nodeMode: 'mixed',
  };
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

function formatRatio(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}
