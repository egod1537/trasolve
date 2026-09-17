import { NonIdealState } from '@blueprintjs/core';
import { memo, useMemo } from 'react';
import type { TestbedJob } from '@/entities/route-job';
import { JobListItem } from '@/features/troute-testbed/components/jobs/JobListItem';

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
  const orderedJobs = useMemo(
    () => [...jobs].sort((left, right) => right.createdAt - left.createdAt),
    [jobs],
  );

  if (jobs.length === 0) {
    return (
      <NonIdealState
        className="job-list-empty"
        icon="inbox"
        title="아직 Job이 없습니다."
        description="새 Job을 만들어 최적화 요청을 실행하세요."
      />
    );
  }

  return (
    <div className="job-list" role="listbox" aria-label="테스트베드 Jobs">
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
