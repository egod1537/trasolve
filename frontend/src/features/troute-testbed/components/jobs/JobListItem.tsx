import { Classes } from '@blueprintjs/core';
import { memo } from 'react';
import type { TestbedJob } from '@/entities/route-job';
import { JobStatusBadge } from '@/features/troute-testbed/components/JobStatusBadge';

interface JobListItemProps {
  job: TestbedJob;
  selected: boolean;
  onSelect: (jobId: string) => void;
}

export const JobListItem = memo(function JobListItem({
  job,
  selected,
  onSelect,
}: JobListItemProps) {
  return (
    <button
      type="button"
      className="job-list-item"
      role="option"
      aria-selected={selected}
      data-job-id={job.id}
      data-status={job.status}
      onClick={() => onSelect(job.id)}
    >
      <span className="job-list-item-primary">
        <span className={`${Classes.MONOSPACE_TEXT} job-list-item-id`}>
          {job.id}
        </span>
        <JobStatusBadge status={job.status} />
      </span>
      <span className={`${Classes.TEXT_MUTED} job-list-item-secondary`}>
        {job.progress}% · {new Date(job.createdAt).toLocaleTimeString()}
      </span>
    </button>
  );
});
