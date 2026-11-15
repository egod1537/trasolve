import { Classes } from '@blueprintjs/core';
import { useState } from 'react';
import { TcacheResultMap } from '@/features/tcache-route-testbed/components/detail/TcacheResultMap';
import type { TcacheRouteJob } from '@/features/tcache-route-testbed/model/types';
import { useL, NL } from '@/shared/i18n';
import { Metadata } from '@/features/tcache-route-testbed/components/detail/JobRequestSections';
import {
  formatCache,
  formatDate,
  formatDistance,
  formatDuration,
  formatJson,
} from '@/features/tcache-route-testbed/components/detail/jobDetailFormatters';

export function ResultSection({ job }: { job: TcacheRouteJob }) {
  const L = useL();
  const result = job.result;
  const [selection, setSelection] = useState({ jobId: job.id, index: 0 });
  if (!result) {
    return (
      <section aria-labelledby="tcache-result-title">
        <h2 id="tcache-result-title">
          {L('testbed:jobDetail.resultSection.title.result')}
        </h2>
        <p className={Classes.TEXT_MUTED}>
          {L(
            'testbed:jobDetail.resultSection.description.noRouteResultsHaveBeenReceived',
          )}
        </p>
      </section>
    );
  }
  const selectedRouteIndex = selection.jobId === job.id ? selection.index : 0;
  const selectedRoute = result.routes[selectedRouteIndex] ?? result.routes[0];
  const legs = selectedRoute?.legs ?? result.legs;
  return (
    <section aria-labelledby="tcache-result-title">
      <h2 id="tcache-result-title">
        {L('testbed:jobDetail.resultSection.title.result')}
      </h2>
      <TcacheResultMap
        routes={result.routes}
        locations={job.request.locations}
        selectedIndex={selectedRouteIndex}
        onSelect={(index) => setSelection({ jobId: job.id, index })}
      />
      <dl className="tcache-metadata-grid">
        <Metadata
          label={L('testbed:jobDetail.resultSection.text.routeCount')}
          value={String(result.routeCount)}
        />
        <Metadata
          label={L('testbed:jobDetail.result.label.distance')}
          value={formatDistance(
            selectedRoute?.distanceMeters ?? result.distanceMeters,
          )}
        />
        <Metadata
          label={L('testbed:jobDetail.result.label.duration')}
          value={formatDuration(
            selectedRoute?.durationSeconds ?? result.durationSeconds,
          )}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.label.provider')}
          value={selectedRoute?.provider ?? result.provider ?? '-'}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.label.cache')}
          value={formatCache(result.cacheStatus)}
        />
        <Metadata
          label={L('testbed:jobDetail.result.label.latency')}
          value={
            result.latencyMs === undefined
              ? '-'
              : `${result.latencyMs}${NL('ms')}`
          }
        />
      </dl>
      {legs.length ? (
        <ol className="tcache-leg-list">
          {legs.map((leg, index) => (
            <li key={`${leg.from}-${leg.to}-${index}`}>
              <strong>
                {leg.from} → {leg.to}
              </strong>
              <span className={Classes.TEXT_MUTED}>
                {formatDistance(leg.distanceMeters)} ·{' '}
                {formatDuration(leg.durationSeconds)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <details>
        <summary>{L('testbed:jobDetail.resultSection.text.rawResult')}</summary>
        <pre className="tcache-raw-json">{formatJson(result.raw)}</pre>
      </details>
    </section>
  );
}

export function TimelineSection({ job }: { job: TcacheRouteJob }) {
  const L = useL();
  return (
    <section aria-labelledby="tcache-timeline-title">
      <h2 id="tcache-timeline-title">
        {L('testbed:jobDetail.timelineSection.title.timeline')}
      </h2>
      {job.timeline.length === 0 ? (
        <p className={Classes.TEXT_MUTED}>
          {L(
            'testbed:jobDetail.timelineSection.description.noCommunicationEventsObserved',
          )}
        </p>
      ) : (
        <ol className="tcache-timeline">
          {job.timeline.map((entry) => (
            <li key={entry.id}>
              <time>{formatDate(entry.timestamp)}</time>
              <strong>
                {entry.direction} · {entry.label}
              </strong>
              <span className={Classes.TEXT_MUTED}>
                {[
                  entry.path,
                  entry.status,
                  entry.latencyMs === undefined ? null : `${entry.latencyMs}ms`,
                ]
                  .filter((value) => value !== undefined && value !== null)
                  .join(' · ')}
              </span>
              {entry.body === undefined ? null : (
                <pre>{formatJson(entry.body)}</pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function RawSection({ job }: { job: TcacheRouteJob }) {
  const L = useL();
  return (
    <details>
      <summary>{L('testbed:jobDetail.rawSection.text.originalJson')}</summary>
      <pre className="tcache-raw-json">{formatJson(job)}</pre>
    </details>
  );
}
