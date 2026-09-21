import {
  Button as BlueprintButton,
  Card,
  Classes,
  Divider,
} from '@blueprintjs/core';
import { memo } from 'react';
import type { TestbedJob } from '@/entities/route-job';
import { JobList } from '@/features/troute-testbed/components/jobs/JobList';
import { IconButton } from '@/shared/ui/IconButton';
import { Tooltip } from '@/shared/ui/Tooltip';
import { RefreshIcon } from '@/shared/ui/icons';

interface JobSidebarProps {
  jobs: TestbedJob[];
  selectedJobId: string | null;
  refreshing: boolean;
  onNewJob: () => void;
  onRefresh: () => void;
  onSelect: (jobId: string) => void;
}

export const JobSidebar = memo(function JobSidebar({
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
          <Tooltip label="Job 목록 새로고침">
            <IconButton
              className="jobs-refresh-button"
              aria-label={
                refreshing ? 'Job 목록 새로고침 중' : 'Job 목록 새로고침'
              }
              icon={<RefreshIcon />}
              variant="ghost"
              size="sm"
              loading={refreshing}
              disabled={refreshing}
              onClick={onRefresh}
            />
          </Tooltip>
          <BlueprintButton icon="plus" intent="primary" onClick={onNewJob}>
            새 Job
          </BlueprintButton>
        </div>
      </div>
      <Divider />
      <JobList jobs={jobs} selectedJobId={selectedJobId} onSelect={onSelect} />
    </Card>
  );
});
