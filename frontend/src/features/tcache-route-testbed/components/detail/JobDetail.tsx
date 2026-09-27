import {
  Button,
  Callout,
  Card,
  Classes,
  Divider,
  HTMLTable,
  NonIdealState,
  ProgressBar,
  Tag,
} from '@blueprintjs/core';
import { memo, useState } from 'react';
import { JobStatusBadge } from '@/features/tcache-route-testbed/components/JobStatusBadge';
import { TcacheResultMap } from '@/features/tcache-route-testbed/components/detail/TcacheResultMap';
import type {
  TcacheRouteJob,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { getTcacheRouteLocationRole } from '@/features/tcache-route-testbed/model/viewModel';
import { getLanguage, useL, L, NL } from '@/shared/i18n';

interface JobDetailProps {
  job: TcacheRouteJob | null;
  streamState: TcacheStreamState;
  cancelling: boolean;
  onRequestCancel: (jobId: string) => void;
}

export const JobDetail = memo(function JobDetail({
  job,
  streamState,
  cancelling,
  onRequestCancel,
}: JobDetailProps) {
  const L = useL();
  if (!job) {
    return (
      <Card
        className="tcache-job-detail tcache-job-detail-empty"
        elevation={1}
        compact
      >
        <NonIdealState
          icon="route"
          title={L(
            'testbed:jobDetail.tooltip.selectRouteOperationYouWantCheck',
          )}
          description={L(
            'testbed:jobDetail.text.newTasksAutomaticallySelectedImmediatelyAfter',
          )}
        />
      </Card>
    );
  }

  const active = job.status === 'queued' || job.status === 'running';
  return (
    <Card className="tcache-job-detail" elevation={1} compact>
      <div className="tcache-detail-heading">
        <div>
          <h1 className={Classes.HEADING}>
            {L('testbed:jobDetail.title.jobDetails')}
          </h1>
          <span className={Classes.TEXT_MUTED}>
            {L(
              'testbed:jobDetail.text.trasolveTcacheCommunicationObservationInformation',
            )}
          </span>
        </div>
        {active ? (
          <Button
            icon="stop"
            intent="danger"
            loading={cancelling}
            disabled={cancelling}
            onClick={() => onRequestCancel(job.id)}
          >
            {L('testbed:cancelJobDialog.tooltip.cancelRouteOperation')}
          </Button>
        ) : null}
      </div>
      <Divider />
      <div className="tcache-detail-content">
        <Overview job={job} />
        <Divider />
        <RequestSection job={job} />
        <Divider />
        <ProgressSection job={job} streamState={streamState} />
        {job.error ? (
          <Callout
            intent="danger"
            title={L('testbed:jobDetail.tooltip.taskFailed')}
            role="alert"
          >
            {job.error}
          </Callout>
        ) : null}
        <Divider />
        <ResultSection job={job} />
        <Divider />
        <TimelineSection job={job} />
        <Divider />
        <RawSection job={job} />
      </div>
    </Card>
  );
});

function Overview({ job }: { job: TcacheRouteJob }) {
  const L = useL();
  return (
    <section aria-labelledby="tcache-overview-title">
      <h2 id="tcache-overview-title">
        {L('testbed:jobDetail.overview.title.overview')}
      </h2>
      <dl className="tcache-metadata-grid">
        <Metadata
          label={L('testbed:jobDetail.overview.text.jobId')}
          value={job.id}
          mono
        />
        <div>
          <dt>{L('testbed:jobDetail.overview.label.status')}</dt>
          <dd>
            <JobStatusBadge status={job.status} />
          </dd>
        </div>
        <Metadata
          label={L('testbed:jobDetail.overview.text.currentStage')}
          value={job.stage ?? '-'}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.text.progress')}
          value={`${job.progress}%`}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.text.creationTime')}
          value={formatDate(job.createdAt)}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.text.completionTime')}
          value={job.completedAt ? formatDate(job.completedAt) : '-'}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.text.communicationMethod')}
          value={NL('HTTP + SSE')}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.label.cache')}
          value={formatCache(job.cacheStatus)}
        />
        <Metadata
          label={L('testbed:jobDetail.overview.label.provider')}
          value={job.provider ?? job.result?.provider ?? '-'}
        />
      </dl>
    </section>
  );
}

function RequestSection({ job }: { job: TcacheRouteJob }) {
  const L = useL();
  return (
    <section aria-labelledby="tcache-request-title">
      <div className="tcache-section-heading">
        <h2 id="tcache-request-title">
          {L('testbed:jobDetail.requestSection.title.request')}
        </h2>
        <Tag minimal>{job.request.mode}</Tag>
      </div>
      <p className={Classes.TEXT_MUTED}>
        {L('testbed:jobDetail.requestSection.description.departureTime')}
        {job.request.departureTime ??
          L('testbed:jobDetail.requestSection.description.notSpecified')}
      </p>
      <div className="tcache-table-scroll">
        <HTMLTable compact striped>
          <thead>
            <tr>
              <th>{L('testbed:jobDetail.requestSection.text.order')}</th>
              <th>{L('testbed:jobDetail.requestSection.text.role')}</th>
              <th>{L('testbed:jobDetail.requestSection.text.location')}</th>
              <th>{L('testbed:jobDetail.requestSection.text.placeId')}</th>
              <th>
                {L('testbed:jobDetail.requestSection.text.coordinatesAddress')}
              </th>
            </tr>
          </thead>
          <tbody>
            {job.request.locations.map((location, index) => (
              <tr key={`${location.id}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  {getTcacheRouteLocationRole(
                    index,
                    job.request.locations.length,
                  )}
                </td>
                <td>{location.name}</td>
                <td>
                  <code>{location.placeId ?? '-'}</code>
                </td>
                <td>{formatLocation(location)}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </div>
    </section>
  );
}

function ProgressSection({
  job,
  streamState,
}: {
  job: TcacheRouteJob;
  streamState: TcacheStreamState;
}) {
  const L = useL();
  const event = job.progressEvent;
  return (
    <section aria-labelledby="tcache-progress-title">
      <div className="tcache-section-heading">
        <h2 id="tcache-progress-title">
          {L('testbed:jobDetail.progressSection.title.progress')}
        </h2>
        <Tag
          minimal
          intent={
            streamState === 'connected'
              ? 'success'
              : streamState === 'retrying'
                ? 'warning'
                : 'none'
          }
        >
          {L('testbed:jobDetail.text.sse', {
            formatStreamState: formatStreamState(streamState),
          })}
        </Tag>
      </div>
      <ProgressBar
        animate={job.status === 'running'}
        stripes={job.status === 'running'}
        value={job.progress / 100}
        intent={job.status === 'failed' ? 'danger' : 'primary'}
      />
      <dl className="tcache-metadata-grid tcache-progress-metadata">
        <Metadata
          label={L('testbed:jobDetail.progress.label.stage')}
          value={event?.stage ?? job.stage ?? '-'}
        />
        <Metadata
          label={L('testbed:jobSummary.label.message')}
          value={event?.message ?? '-'}
        />
        <Metadata
          label={L('testbed:jobDetail.progressSection.text.recentEvents')}
          value={event ? formatDate(event.timestamp) : '-'}
        />
      </dl>
    </section>
  );
}

function ResultSection({ job }: { job: TcacheRouteJob }) {
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

function TimelineSection({ job }: { job: TcacheRouteJob }) {
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

function RawSection({ job }: { job: TcacheRouteJob }) {
  const L = useL();
  return (
    <details>
      <summary>{L('testbed:jobDetail.rawSection.text.originalJson')}</summary>
      <pre className="tcache-raw-json">{formatJson(job)}</pre>
    </details>
  );
}

function Metadata({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? Classes.MONOSPACE_TEXT : undefined}>{value}</dd>
    </div>
  );
}

function formatStreamState(state: TcacheStreamState): string {
  if (state === 'connected') {
    return L('testbed:jobDetail.formatStreamState.text.connected');
  }
  if (state === 'connecting') {
    return L('testbed:jobDetail.formatStreamState.text.connecting');
  }
  if (state === 'retrying') {
    return L('testbed:jobDetail.formatStreamState.text.reconnecting');
  }
  if (state === 'disconnected') {
    return L('testbed:jobDetail.formatStreamState.text.connectionLost');
  }
  return L('testbed:jobDetail.formatStreamState.text.waiting');
}

function formatCache(value: TcacheRouteJob['cacheStatus']): string {
  return value ? value.toUpperCase() : '-';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(getLanguage());
}

function formatDistance(value?: number): string {
  if (value === undefined) {
    return '-';
  }
  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}${NL('km')}`
    : `${value}${NL('m')}`;
}

function formatDuration(value?: number): string {
  if (value === undefined) {
    return '-';
  }
  return value >= 3_600
    ? L('testbed:jobDetail.formatDuration.text.hoursMinutes', {
        floor: Math.floor(value / 3_600),
        round: Math.round((value % 3_600) / 60),
      })
    : L('testbed:jobDetail.formatDuration.text.minutes', {
        round: Math.round(value / 60),
      });
}

function formatLocation(
  location: TcacheRouteJob['request']['locations'][number],
): string {
  if (location.lat !== undefined && location.lng !== undefined) {
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }
  return location.address ?? '-';
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
