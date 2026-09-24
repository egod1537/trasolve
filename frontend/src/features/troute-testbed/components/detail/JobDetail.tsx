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
  if (!job) {
    return (
      <Card className="job-detail job-detail-empty" elevation={1} compact>
        <NonIdealState
          icon="search"
          title="실행 정보를 확인할 Job을 선택하세요."
          description="새 Job은 생성 즉시 왼쪽 목록에 표시됩니다."
        />
      </Card>
    );
  }

  const optimization = getFinalOptimization(job);

  return (
    <Card className="job-detail" elevation={1} compact>
      <div className="detail-heading">
        <div className="detail-heading-copy">
          <h1 className={Classes.HEADING}>Job 상세</h1>
          <span className={Classes.TEXT_MUTED}>
            Trasolve gateway 관찰 정보
            {streamStatus === 'retrying' ? (
              <span
                className="job-stream-retrying"
                role="status"
                title={streamError ?? undefined}
              >
                연결 재시도 중
              </span>
            ) : null}
          </span>
        </div>
        {job.status === 'pending' || job.status === 'running' ? (
          <Button
            aria-label="Job 강제 종료"
            icon="stop"
            intent={Intent.DANGER}
            loading={cancelling}
            disabled={cancelling}
            onClick={() => onRequestCancel(job.id)}
          >
            Job 강제 종료
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
            title="요청 실패"
          >
            {job.error}
          </Callout>
        ) : null}

        {job.inspectionError ? (
          <Callout
            compact
            intent={Intent.WARNING}
            role="status"
            title="Job 상태 확인 실패"
          >
            {job.inspectionError} 기존 gateway 결과와 Timeline은 유지됩니다.
          </Callout>
        ) : null}

        {job.cancelError ? (
          <Callout
            compact
            intent={Intent.DANGER}
            role="alert"
            title="Job 강제 종료에 실패했습니다."
          >
            {job.cancelError}
          </Callout>
        ) : null}

        {hasResultMismatch(job) ? (
          <Callout
            compact
            intent={Intent.WARNING}
            role="status"
            title="결과 불일치"
          >
            Job 조회 결과와 gateway 응답의 최적화 결과가 다릅니다. Job 조회
            결과를 우선 표시합니다.
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
