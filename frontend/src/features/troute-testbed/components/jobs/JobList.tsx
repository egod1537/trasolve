import { NonIdealState } from '@blueprintjs/core';
import { memo, useEffect, useMemo, useRef } from 'react';
import type { TestbedJob } from '@/entities/route-job';
import { JobListItem } from '@/features/troute-testbed/components/jobs/JobListItem';
import { useL } from '@/shared/i18n';

interface JobListProps {
  jobs: TestbedJob[];
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
}

export const JobList = memo(function JobList({
  jobs,
  selectedJobId,
  onSelect,
}: JobListProps) {
  const L = useL();
  const listRef = useRef<HTMLDivElement>(null);
  const orderedJobs = useMemo(
    () => [...jobs].sort((left, right) => right.createdAt - left.createdAt),
    [jobs],
  );

  useEffect(() => {
    if (selectedJobId === null) {
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedJobId]);

  if (jobs.length === 0) {
    return (
      <NonIdealState
        className="job-list-empty"
        icon="inbox"
        title={L('testbed:jobList.tooltip.thereNoJobsYet')}
        description={L(
          'testbed:jobList.text.createNewJobRunOptimizationRequest',
        )}
      />
    );
  }

  return (
    <div
      ref={listRef}
      className="job-list"
      role="listbox"
      aria-label={L('testbed:jobList.ariaLabel.testbedJobs')}
    >
      {orderedJobs.map((job) => (
        <JobListItem
          key={job.id}
          job={job}
          selected={job.id === selectedJobId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
});
