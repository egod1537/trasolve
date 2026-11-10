import {
  Button,
  Callout,
  Card,
  Classes,
  Divider,
  NonIdealState,
} from '@blueprintjs/core';
import { memo } from 'react';
import type {
  TcacheRouteJob,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { useL } from '@/shared/i18n';
import {
  Overview,
  RequestSection,
  ProgressSection,
} from '@/features/tcache-route-testbed/components/detail/JobRequestSections';
import {
  ResultSection,
  TimelineSection,
  RawSection,
} from '@/features/tcache-route-testbed/components/detail/JobResultSections';

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
