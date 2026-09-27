import { Classes } from '@blueprintjs/core';
import { memo, useEffect, useState } from 'react';
import type { TestbedJob } from '@/entities/route-job';
import {
  formatJobStatus,
  getJobStatusTone,
  JobStatusBadge,
} from '@/features/troute-testbed/components/JobStatusBadge';
import { Progress } from '@/shared/ui/Progress';
import { useL, L } from '@/shared/i18n';

export const JobSummary = memo(function JobSummary({
  job,
}: {
  job: TestbedJob;
}) {
  const L = useL();
  const elapsed = useElapsed(job);

  return (
    <section className="job-summary" aria-labelledby="job-summary-title">
      <div className="job-summary-heading">
        <div>
          <h2 id="job-summary-title" className={Classes.HEADING}>
            {job.id}
          </h2>
          <span className={Classes.TEXT_MUTED}>
            {L('testbed:jobSummary.text.jobIdFrontendObservationJob')}
          </span>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <dl className="job-facts">
        <div>
          <dt>{L('testbed:jobDetail.overview.label.status')}</dt>
          <dd>{formatJobStatus(job.status, L)}</dd>
        </div>
        <div>
          <dt>{L('testbed:jobDetail.overview.text.progress')}</dt>
          <dd>{job.progress}%</dd>
        </div>
        <div>
          <dt>{L('testbed:jobSummary.label.step')}</dt>
          <dd>{job.stage ?? '—'}</dd>
        </div>
        <div>
          <dt>{L('testbed:jobSummary.label.message')}</dt>
          <dd>{job.message ?? '—'}</dd>
        </div>
        <div>
          <dt>{L('testbed:jobDetail.overview.text.creationTime')}</dt>
          <dd>{new Date(job.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>{L('testbed:jobSummary.label.elapsedTime')}</dt>
          <dd>{elapsed}</dd>
        </div>
      </dl>
      <Progress
        label={L('testbed:jobSummary.text.jobProgress', {
          progress: job.progress,
        })}
        tone={getJobStatusTone(job.status)}
        value={job.progress}
        animated={job.status === 'running'}
      />
    </section>
  );
});

function useElapsed(job: TestbedJob): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (job.status !== 'running' && job.status !== 'pending') {
      return;
    }
    const updateNow = () => {
      if (!document.hidden) {
        setNow(Date.now());
      }
    };
    const interval = window.setInterval(updateNow, 1_000);
    document.addEventListener('visibilitychange', updateNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, [job.status]);

  return formatElapsed((job.completedAt ?? now) - job.createdAt);
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, milliseconds) / 1000;
  if (totalSeconds < 60) {
    return L('testbed:jobSummary.formatElapsed.text.seconds', {
      toFixed: totalSeconds.toFixed(1),
    });
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return L('testbed:jobSummary.formatElapsed.text.minutesSeconds', {
    minutes: minutes,
    padStart: seconds.toString().padStart(2, '0'),
  });
}
