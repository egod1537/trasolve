import {
  Button,
  Card,
  Classes,
  Divider,
  NonIdealState,
} from '@blueprintjs/core';
import { memo, useEffect, useMemo, useRef } from 'react';
import { JobStatusBadge } from '@/features/tcache-route-testbed/components/JobStatusBadge';
import type { TcacheRouteJob } from '@/features/tcache-route-testbed/model/types';
import { Progress } from '@/shared/ui/Progress';
import { getLanguage, useL } from '@/shared/i18n';

interface JobSidebarProps {
  jobs: TcacheRouteJob[];
  selectedJobId: string | null;
  refreshing: boolean;
  error: string | null;
  onNewJob: () => void;
  onRefresh: () => void;
  onSelect: (jobId: string) => void;
}

export const JobSidebar = memo(function JobSidebar({
  jobs,
  selectedJobId,
  refreshing,
  error,
  onNewJob,
  onRefresh,
  onSelect,
}: JobSidebarProps) {
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

  return (
    <Card className="tcache-job-sidebar" elevation={1} compact>
      <div className="tcache-sidebar-heading">
        <div>
          <h1 className={Classes.HEADING}>
            {L('testbed:jobSidebar.title.pathOperation')}
          </h1>
          <span className={Classes.TEXT_MUTED}>
            {L('testbed:jobSidebar.text.tcacheRouteJobs')}
          </span>
        </div>
        <div className="tcache-sidebar-actions">
          <Button
            aria-label={L('testbed:jobSidebar.ariaLabel.refreshRouteTaskList')}
            title={L('testbed:jobSidebar.ariaLabel.refreshRouteTaskList')}
            icon="refresh"
            loading={refreshing}
            disabled={refreshing}
            variant="minimal"
            onClick={onRefresh}
          />
          <Button icon="plus" intent="primary" onClick={onNewJob}>
            {L('testbed:jobSidebar.action.newRequest')}
          </Button>
        </div>
      </div>
      <Divider />
      {error ? (
        <p className="tcache-sidebar-error" role="status">
          {error}
        </p>
      ) : null}
      {orderedJobs.length === 0 ? (
        <NonIdealState
          className="tcache-job-list-empty"
          icon="inbox"
          title={L('testbed:jobSidebar.tooltip.noTcacheRouteTaskWasCreated')}
          description={L(
            'testbed:jobSidebar.text.testTrasolveTcacheCommunicationByCreating',
          )}
        />
      ) : (
        <div
          ref={listRef}
          className="tcache-job-list"
          role="listbox"
          aria-label={L('testbed:jobSidebar.ariaLabel.tcacheRouteTaskList')}
        >
          {orderedJobs.map((job) => (
            <button
              type="button"
              className="tcache-job-list-item"
              role="option"
              aria-selected={job.id === selectedJobId}
              key={job.id}
              onClick={() => onSelect(job.id)}
            >
              <span className="tcache-job-list-primary">
                <span className={`${Classes.MONOSPACE_TEXT} tcache-job-id`}>
                  {job.id}
                </span>
                <JobStatusBadge status={job.status} />
              </span>
              <span className={`${Classes.TEXT_MUTED} tcache-job-meta`}>
                {job.request.mode} · {formatTime(job.createdAt)}
                {job.cacheStatus ? (
                  <>
                    {' · '}
                    {L('testbed:jobDetail.overview.label.cache')}{' '}
                    {job.cacheStatus.toUpperCase()}
                  </>
                ) : null}
              </span>
              <Progress
                className="tcache-job-progress"
                value={job.progress}
                label={L('testbed:jobSidebar.text.progress', { id: job.id })}
                animated={job.status === 'running'}
                tone={job.status === 'failed' ? 'danger' : 'accent'}
              />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
});

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(getLanguage(), {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
