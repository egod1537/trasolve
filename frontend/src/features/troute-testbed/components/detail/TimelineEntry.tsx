import { Button, Classes, Intent, Tag } from '@blueprintjs/core';
import { memo, useEffect, useMemo, useState } from 'react';
import type { TimelineEntry as Entry } from '@/entities/route-job';
import { useL, L } from '@/shared/i18n';

export const TimelineEntry = memo(function TimelineEntry({
  entry,
}: {
  entry: Entry;
}) {
  const L = useL();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const formattedTime = useMemo(
    () => formatTimelineTime(entry.timestamp),
    [entry.timestamp],
  );
  const operationSummary = useMemo(
    () =>
      entry.direction === 'REQUEST'
        ? `${entry.method ?? 'HTTP'} ${entry.path ?? ''}`
        : responseSummary(entry),
    [entry],
  );

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <details
      className="timeline-entry"
      data-direction={entry.direction}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span className="timeline-entry-time">{formattedTime}</span>
        <Tag
          className="timeline-direction"
          intent={
            entry.error
              ? Intent.DANGER
              : entry.direction === 'REQUEST'
                ? Intent.PRIMARY
                : Intent.SUCCESS
          }
          minimal
        >
          {entry.direction}
        </Tag>
        <span className="timeline-route">
          <strong>{entry.source}</strong>
          <span aria-hidden="true">→</span>
          <strong>{entry.target}</strong>
        </span>
        <span className={`${Classes.MONOSPACE_TEXT} timeline-operation`}>
          {operationSummary}
        </span>
        <Button
          aria-label={
            copied
              ? L('testbed:jobRequestSummary.action.copied')
              : L('testbed:timelineEntry.ariaLabel.copyTimelineItems')
          }
          title={
            copied
              ? L('testbed:jobRequestSummary.action.copied')
              : L('common:action.copy')
          }
          icon={copied ? 'tick' : 'clipboard'}
          intent={copied ? Intent.SUCCESS : Intent.NONE}
          size="small"
          variant="minimal"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void copyEntry(entry).then(setCopied);
          }}
        >
          {copied
            ? L('testbed:jobRequestSummary.action.copied')
            : L('common:action.copy')}
        </Button>
      </summary>
      {expanded ? (
        <div className="timeline-entry-detail">
          {entry.direction === 'REQUEST' ? (
            <RequestDetail entry={entry} />
          ) : (
            <ResponseDetail entry={entry} />
          )}
        </div>
      ) : null}
    </details>
  );
});

function RequestDetail({ entry }: { entry: Entry }) {
  const L = useL();
  return (
    <>
      <DetailValue
        title={L('testbed:timelineEntry.detail.label.headers')}
        value={
          entry.headers ??
          L('testbed:routeResultPanel.routeDebugDetails.text.none')
        }
      />
      <DetailValue
        title={L('testbed:timelineEntry.detail.label.query')}
        value={entry.query ?? {}}
      />
      <DetailValue
        title={L('testbed:timelineEntry.detail.label.body')}
        value={entry.body ?? null}
      />
      <DetailValue
        title={L('testbed:timelineEntry.requestDetail.tooltip.rawPayload')}
        value={entry.raw ?? ''}
        raw
      />
    </>
  );
}

function ResponseDetail({ entry }: { entry: Entry }) {
  const L = useL();
  return (
    <>
      <DetailValue
        title={L('testbed:timelineEntry.responseDetail.tooltip.httpStatus')}
        value={
          entry.status ??
          L('testbed:routeResultPanel.routeDebugDetails.text.none')
        }
      />
      <DetailValue
        title={L('testbed:timelineEntry.detail.label.headers')}
        value={
          entry.headers ??
          L('testbed:routeResultPanel.routeDebugDetails.text.none')
        }
      />
      <DetailValue
        title={L('testbed:timelineEntry.detail.label.body')}
        value={entry.body ?? null}
      />
      <DetailValue
        title={L('testbed:timelineEntry.responseDetail.tooltip.rawResponse')}
        value={entry.raw ?? ''}
        raw
      />
      {entry.error ? (
        <DetailValue title={L('common:status.error')} value={entry.error} raw />
      ) : null}
    </>
  );
}

function DetailValue({
  title,
  value,
  raw = false,
}: {
  title: string;
  value: unknown;
  raw?: boolean;
}) {
  const formatted = useMemo(
    () =>
      raw && typeof value === 'string'
        ? value || L('testbed:timelineEntry.detailValue.text.empty')
        : formatValue(value),
    [raw, value],
  );
  return (
    <section className="timeline-detail-section">
      <h3>{title}</h3>
      <pre className={`${Classes.CODE_BLOCK} timeline-code`}>{formatted}</pre>
    </section>
  );
}

function responseSummary(entry: Entry): string {
  const status = entry.status ? `HTTP ${entry.status}` : 'RESPONSE';
  const latency =
    entry.latencyMs === undefined ? '' : ` · ${entry.latencyMs.toFixed(1)} ms`;
  return `${status}${latency}`;
}

function formatTimelineTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value || L('testbed:timelineEntry.detailValue.text.empty');
  }
  return JSON.stringify(value, null, 2) ?? String(value);
}

async function copyEntry(entry: Entry): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
    return true;
  } catch {
    // The expanded payload remains selectable when clipboard access is denied.
    return false;
  }
}
