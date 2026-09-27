import {
  Button,
  Callout,
  Card,
  Classes,
  Divider,
  Intent,
  NonIdealState,
} from '@blueprintjs/core';
import { memo } from 'react';
import {
  getFinalOptimization,
  hasResultMismatch,
  type TestbedJob,
} from '@/entities/route-job';
import { JobRequestSummary } from '@/features/troute-testbed/components/detail/JobRequestSummary';
import { JobResultSummary } from '@/features/troute-testbed/components/detail/JobResultSummary';
import { JobSummary } from '@/features/troute-testbed/components/detail/JobSummary';
import { JobTimeline } from '@/features/troute-testbed/components/detail/JobTimeline';
import type { TrouteJobEventStreamStatus } from '@/features/troute-testbed/model/useTrouteJobEventStream';
import { useL } from '@/shared/i18n';

interface JobDetailProps {
  job: TestbedJob | null;
  cancelling: boolean;
  streamStatus: TrouteJobEventStreamStatus;
  streamError: string | null;
  onRequestCancel: (jobId: string) => void;
}

export const JobDetail = memo(function JobDetail({
  job,
  cancelling,
  streamStatus,
  streamError,
  onRequestCancel,
}: JobDetailProps) {
  const L = useL();
  if (!job) {
    return (
      <Card className="job-detail job-detail-empty" elevation={1} compact>
        <NonIdealState
          icon="search"
          title={L(
            'testbed:jobDetail.tooltip.selectJobCheckExecutionInformation',
          )}
          description={L('testbed:jobDetail.text.newJobsAppearListLeftAs')}
        />
      </Card>
    );
  }

  const optimization = getFinalOptimization(job);

  return (
    <Card className="job-detail" elevation={1} compact>
      <div className="detail-heading">
        <div className="detail-heading-copy">
          <h1 className={Classes.HEADING}>
            {L('testbed:jobDetail.title.jobDetails')}
          </h1>
          <span className={Classes.TEXT_MUTED}>
            {L('testbed:jobDetail.text.trasolveGatewayObservationInformation')}
            {streamStatus === 'retrying' ? (
              <span
                className="job-stream-retrying"
                role="status"
                title={streamError ?? undefined}
              >
                {L('testbed:jobDetail.text.retryingConnection')}
              </span>
            ) : null}
          </span>
        </div>
        {job.status === 'pending' || job.status === 'running' ? (
          <Button
            aria-label={L('testbed:cancelJobDialog.tooltip.forceQuitJob')}
            icon="stop"
            intent={Intent.DANGER}
            loading={cancelling}
            disabled={cancelling}
            onClick={() => onRequestCancel(job.id)}
          >
            {L('testbed:cancelJobDialog.tooltip.forceQuitJob')}
          </Button>
        ) : null}
      </div>
      <Divider />
      <div className="job-detail-content">
        <JobSummary job={job} />
        <Divider />
        <JobRequestSummary key={job.id} request={job.request} />

        {job.error ? (
          <Callout
            compact
            intent={Intent.DANGER}
            role="alert"
            title={L('testbed:jobDetail.tooltip.requestFailed')}
          >
            {job.error}
          </Callout>
        ) : null}

        {job.inspectionError ? (
          <Callout
            compact
            intent={Intent.WARNING}
            role="status"
            title={L('testbed:jobDetail.tooltip.requestFailed')}
          >
            {L(
              'testbed:jobDetail.text.existingGatewayResultsTimelineMaintained',
              { inspectionError: job.inspectionError },
            )}
          </Callout>
        ) : null}

        {job.cancelError ? (
          <Callout
            compact
            intent={Intent.DANGER}
            role="alert"
            title={L('testbed:jobDetail.tooltip.forceTerminationJobFailed')}
          >
            {job.cancelError}
          </Callout>
        ) : null}

        {hasResultMismatch(job) ? (
          <Callout
            compact
            intent={Intent.WARNING}
            role="status"
            title={L('testbed:jobDetail.tooltip.resultDiscrepancy')}
          >
            {L(
              'testbed:jobDetail.text.optimizationResultsJobQueryResultGateway',
            )}
          </Callout>
        ) : null}

        <Divider />
        <JobResultSummary job={job} optimization={optimization} />

        <Divider />
        <JobTimeline jobId={job.id} timeline={job.timeline} />
      </div>
    </Card>
  );
});
