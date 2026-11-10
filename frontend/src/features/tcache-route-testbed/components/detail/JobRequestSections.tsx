import { Classes, HTMLTable, ProgressBar, Tag } from '@blueprintjs/core';
import { JobStatusBadge } from '@/features/tcache-route-testbed/components/JobStatusBadge';
import type {
  TcacheRouteJob,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { getTcacheRouteLocationRole } from '@/features/tcache-route-testbed/model/viewModel';
import { useL, NL } from '@/shared/i18n';
import {
  formatStreamState,
  formatCache,
  formatDate,
  formatLocation,
} from '@/features/tcache-route-testbed/components/detail/jobDetailFormatters';

export function Overview({ job }: { job: TcacheRouteJob }) {
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

export function RequestSection({ job }: { job: TcacheRouteJob }) {
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

export function ProgressSection({
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

export function Metadata({
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
