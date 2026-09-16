import { Button, Card, Classes, Divider } from '@blueprintjs/core';
import type { TestbedJob } from '../../jobs';
import { JobList } from './JobList';

interface JobSidebarProps {
  jobs: TestbedJob[];
  selectedJobId: string | null;
  refreshing: boolean;
  onNewJob: () => void;
  onRefresh: () => void;
  onSelect: (jobId: string) => void;
}

export function JobSidebar({
  jobs,
  selectedJobId,
  refreshing,
  onNewJob,
  onRefresh,
  onSelect,
}: JobSidebarProps) {
  return (
    <Card className="job-sidebar" elevation={1} compact>
      <div className="sidebar-heading">
        <h1 className={Classes.HEADING}>Jobs</h1>
        <div className="sidebar-heading-actions">
          <Button
            className={`jobs-refresh-button${refreshing ? ' is-refreshing' : ''}`}
            aria-label={
              refreshing ? 'Job 목록 새로고침 중' : 'Job 목록 새로고침'
            }
            title="Job 목록 새로고침"
            icon="refresh"
            minimal
            disabled={refreshing}
            onClick={onRefresh}
          />
          <Button icon="plus" intent="primary" onClick={onNewJob}>
            새 Job
          </Button>
        </div>
      </div>
      <Divider />
      <JobList jobs={jobs} selectedJobId={selectedJobId} onSelect={onSelect} />
    </Card>
  );
}
