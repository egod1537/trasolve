import { Button, Classes, Intent, Tag } from '@blueprintjs/core';
import { useEffect, useState } from 'react';
import type { TimelineEntry as Entry } from '../../timeline';

export function TimelineEntry({ entry }: { entry: Entry }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <details className="timeline-entry" data-direction={entry.direction}>
      <summary>
        <span className="timeline-entry-time">
          {formatTimelineTime(entry.timestamp)}
        </span>
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
          {entry.direction === 'REQUEST'
            ? `${entry.method ?? 'HTTP'} ${entry.path ?? ''}`
            : responseSummary(entry)}
        </span>
        <Button
          aria-label={copied ? '복사됨' : 'Timeline 항목 복사'}
          title={copied ? '복사됨' : '복사'}
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
          {copied ? '복사됨' : '복사'}
        </Button>
      </summary>
      <div className="timeline-entry-detail">
        {entry.direction === 'REQUEST' ? (
          <RequestDetail entry={entry} />
        ) : (
          <ResponseDetail entry={entry} />
        )}
      </div>
    </details>
  );
}

function RequestDetail({ entry }: { entry: Entry }) {
  return (
    <>
      <DetailValue title="Headers" value={entry.headers ?? '관찰 정보 없음'} />
      <DetailValue title="Query" value={entry.query ?? {}} />
      <DetailValue title="Body" value={entry.body ?? null} />
      <DetailValue title="Raw payload" value={entry.raw ?? ''} raw />
    </>
  );
}

function ResponseDetail({ entry }: { entry: Entry }) {
  return (
    <>
      <DetailValue
        title="HTTP status"
        value={entry.status ?? '관찰 정보 없음'}
      />
      <DetailValue title="Headers" value={entry.headers ?? '관찰 정보 없음'} />
      <DetailValue title="Body" value={entry.body ?? null} />
      <DetailValue title="Raw response" value={entry.raw ?? ''} raw />
      {entry.error ? (
        <DetailValue title="Error" value={entry.error} raw />
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
  return (
    <section className="timeline-detail-section">
      <h3>{title}</h3>
      <pre className={`${Classes.CODE_BLOCK} timeline-code`}>
        {raw && typeof value === 'string'
          ? value || '(비어 있음)'
          : formatValue(value)}
      </pre>
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
    return value || '(비어 있음)';
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
