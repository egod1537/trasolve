import { Classes, Intent, ProgressBar, Tag } from '@blueprintjs/core';
import { useEffect, useState } from 'react';
import { JOB_STATUS_LABELS, type TestbedJob } from '../../jobs';

const STATUS_INTENTS = {
  pending: Intent.NONE,
  running: Intent.PRIMARY,
  completed: Intent.SUCCESS,
  failed: Intent.DANGER,
  cancelled: Intent.WARNING,
} as const;

export function JobSummary({ job }: { job: TestbedJob }) {
  const elapsed = useElapsed(job);

  return (
    <section className="job-summary" aria-labelledby="job-summary-title">
      <div className="job-summary-heading">
        <div>
          <h2 id="job-summary-title" className={Classes.HEADING}>
            {job.id}
          </h2>
          <span className={Classes.TEXT_MUTED}>job_id · Frontend 관찰 Job</span>
        </div>
        <Tag intent={STATUS_INTENTS[job.status]}>
          {JOB_STATUS_LABELS[job.status]}
        </Tag>
      </div>

      <dl className="job-facts">
        <div>
          <dt>상태</dt>
          <dd>{JOB_STATUS_LABELS[job.status]}</dd>
        </div>
        <div>
          <dt>진행률</dt>
          <dd>{job.progress}%</dd>
        </div>
        <div>
          <dt>단계</dt>
          <dd>{job.stage ?? '—'}</dd>
        </div>
        <div>
          <dt>메시지</dt>
          <dd>{job.message ?? '—'}</dd>
        </div>
        <div>
          <dt>생성 시각</dt>
          <dd>{new Date(job.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>경과 시간</dt>
          <dd>{elapsed}</dd>
        </div>
      </dl>
      <ProgressBar
        aria-label={`Job 진행률 ${job.progress}%`}
        intent={STATUS_INTENTS[job.status]}
        value={job.progress / 100}
        animate={job.status === 'running'}
        stripes={job.status === 'running'}
      />
    </section>
  );
}

function useElapsed(job: TestbedJob): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (job.status !== 'running' && job.status !== 'pending') {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [job.status]);

  return formatElapsed((job.completedAt ?? now) - job.createdAt);
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, milliseconds) / 1000;
  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(1)}초`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}분 ${seconds.toString().padStart(2, '0')}초`;
}
