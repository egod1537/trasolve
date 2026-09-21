import {
  Button,
  Callout,
  Card,
  Classes,
  Divider,
  HTMLTable,
  NonIdealState,
  ProgressBar,
  Tag,
} from '@blueprintjs/core';
import { memo, useState } from 'react';
import { JobStatusBadge } from '@/features/tcache-route-testbed/components/JobStatusBadge';
import { TcacheResultMap } from '@/features/tcache-route-testbed/components/detail/TcacheResultMap';
import type {
  TcacheRouteJob,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { getTcacheRouteLocationRole } from '@/features/tcache-route-testbed/model/viewModel';

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
  if (!job) {
    return (
      <Card
        className="tcache-job-detail tcache-job-detail-empty"
        elevation={1}
        compact
      >
        <NonIdealState
          icon="route"
          title="확인할 경로 작업을 선택하세요."
          description="새 작업은 생성 직후 자동으로 선택됩니다."
        />
      </Card>
    );
  }

  const active = job.status === 'queued' || job.status === 'running';
  return (
    <Card className="tcache-job-detail" elevation={1} compact>
      <div className="tcache-detail-heading">
        <div>
          <h1 className={Classes.HEADING}>Job 상세</h1>
          <span className={Classes.TEXT_MUTED}>
            Trasolve → tcache 통신 관찰 정보
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
            작업 취소
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
          <Callout intent="danger" title="작업 실패" role="alert">
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

function Overview({ job }: { job: TcacheRouteJob }) {
  return (
    <section aria-labelledby="tcache-overview-title">
      <h2 id="tcache-overview-title">개요</h2>
      <dl className="tcache-metadata-grid">
        <Metadata label="Job ID" value={job.id} mono />
        <div>
          <dt>상태</dt>
          <dd>
            <JobStatusBadge status={job.status} />
          </dd>
        </div>
        <Metadata label="현재 단계" value={job.stage ?? '-'} />
        <Metadata label="진행률" value={`${job.progress}%`} />
        <Metadata label="생성 시각" value={formatDate(job.createdAt)} />
        <Metadata
          label="완료 시각"
          value={job.completedAt ? formatDate(job.completedAt) : '-'}
        />
        <Metadata label="통신 방식" value="HTTP + SSE" />
        <Metadata label="Cache" value={formatCache(job.cacheStatus)} />
        <Metadata
          label="Provider"
          value={job.provider ?? job.result?.provider ?? '-'}
        />
      </dl>
    </section>
  );
}

function RequestSection({ job }: { job: TcacheRouteJob }) {
  return (
    <section aria-labelledby="tcache-request-title">
      <div className="tcache-section-heading">
        <h2 id="tcache-request-title">요청</h2>
        <Tag minimal>{job.request.mode}</Tag>
      </div>
      <p className={Classes.TEXT_MUTED}>
        출발 시각: {job.request.departureTime ?? '지정 안 함'}
      </p>
      <div className="tcache-table-scroll">
        <HTMLTable compact striped>
          <thead>
            <tr>
              <th>순서</th>
              <th>역할</th>
              <th>위치</th>
              <th>Place ID</th>
              <th>좌표/주소</th>
            </tr>
          </thead>
          <tbody>
            {job.request.locations.map((location, index) => (
              <tr key={`${location.id}-${index}`}>
                <td>{index + 1}</td>
                <td>
                  {getTcacheRouteLocationRole(
                    index,
                    job.request.locations.length,
                  )}
                </td>
                <td>{location.name}</td>
                <td>
                  <code>{location.placeId ?? '-'}</code>
                </td>
                <td>{formatLocation(location)}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </div>
    </section>
  );
}

function ProgressSection({
  job,
  streamState,
}: {
  job: TcacheRouteJob;
  streamState: TcacheStreamState;
}) {
  const event = job.progressEvent;
  return (
    <section aria-labelledby="tcache-progress-title">
      <div className="tcache-section-heading">
        <h2 id="tcache-progress-title">진행</h2>
        <Tag
          minimal
          intent={
            streamState === 'connected'
              ? 'success'
              : streamState === 'retrying'
                ? 'warning'
                : 'none'
          }
        >
          SSE {formatStreamState(streamState)}
        </Tag>
      </div>
      <ProgressBar
        animate={job.status === 'running'}
        stripes={job.status === 'running'}
        value={job.progress / 100}
        intent={job.status === 'failed' ? 'danger' : 'primary'}
      />
      <dl className="tcache-metadata-grid tcache-progress-metadata">
        <Metadata label="Stage" value={event?.stage ?? job.stage ?? '-'} />
        <Metadata label="Message" value={event?.message ?? '-'} />
        <Metadata
          label="최근 이벤트"
          value={event ? formatDate(event.timestamp) : '-'}
        />
      </dl>
    </section>
  );
}

function ResultSection({ job }: { job: TcacheRouteJob }) {
  const result = job.result;
  const [selection, setSelection] = useState({ jobId: job.id, index: 0 });
  if (!result) {
    return (
      <section aria-labelledby="tcache-result-title">
        <h2 id="tcache-result-title">결과</h2>
        <p className={Classes.TEXT_MUTED}>아직 수신된 경로 결과가 없습니다.</p>
      </section>
    );
  }
  const selectedRouteIndex = selection.jobId === job.id ? selection.index : 0;
  const selectedRoute = result.routes[selectedRouteIndex] ?? result.routes[0];
  const legs = selectedRoute?.legs ?? result.legs;
  return (
    <section aria-labelledby="tcache-result-title">
      <h2 id="tcache-result-title">결과</h2>
      <TcacheResultMap
        routes={result.routes}
        locations={job.request.locations}
        selectedIndex={selectedRouteIndex}
        onSelect={(index) => setSelection({ jobId: job.id, index })}
      />
      <dl className="tcache-metadata-grid">
        <Metadata label="Route count" value={String(result.routeCount)} />
        <Metadata
          label="Distance"
          value={formatDistance(
            selectedRoute?.distanceMeters ?? result.distanceMeters,
          )}
        />
        <Metadata
          label="Duration"
          value={formatDuration(
            selectedRoute?.durationSeconds ?? result.durationSeconds,
          )}
        />
        <Metadata
          label="Provider"
          value={selectedRoute?.provider ?? result.provider ?? '-'}
        />
        <Metadata label="Cache" value={formatCache(result.cacheStatus)} />
        <Metadata
          label="Latency"
          value={result.latencyMs === undefined ? '-' : `${result.latencyMs}ms`}
        />
      </dl>
      {legs.length ? (
        <ol className="tcache-leg-list">
          {legs.map((leg, index) => (
            <li key={`${leg.from}-${leg.to}-${index}`}>
              <strong>
                {leg.from} → {leg.to}
              </strong>
              <span className={Classes.TEXT_MUTED}>
                {formatDistance(leg.distanceMeters)} ·{' '}
                {formatDuration(leg.durationSeconds)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <details>
        <summary>Raw Result</summary>
        <pre className="tcache-raw-json">{formatJson(result.raw)}</pre>
      </details>
    </section>
  );
}

function TimelineSection({ job }: { job: TcacheRouteJob }) {
  return (
    <section aria-labelledby="tcache-timeline-title">
      <h2 id="tcache-timeline-title">타임라인</h2>
      {job.timeline.length === 0 ? (
        <p className={Classes.TEXT_MUTED}>관찰된 통신 이벤트가 없습니다.</p>
      ) : (
        <ol className="tcache-timeline">
          {job.timeline.map((entry) => (
            <li key={entry.id}>
              <time>{formatDate(entry.timestamp)}</time>
              <strong>
                {entry.direction} · {entry.label}
              </strong>
              <span className={Classes.TEXT_MUTED}>
                {[
                  entry.path,
                  entry.status,
                  entry.latencyMs === undefined ? null : `${entry.latencyMs}ms`,
                ]
                  .filter((value) => value !== undefined && value !== null)
                  .join(' · ')}
              </span>
              {entry.body === undefined ? null : (
                <pre>{formatJson(entry.body)}</pre>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function RawSection({ job }: { job: TcacheRouteJob }) {
  return (
    <details>
      <summary>원본 JSON</summary>
      <pre className="tcache-raw-json">{formatJson(job)}</pre>
    </details>
  );
}

function Metadata({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={mono ? Classes.MONOSPACE_TEXT : undefined}>{value}</dd>
    </div>
  );
}

function formatStreamState(state: TcacheStreamState): string {
  if (state === 'connected') {
    return '연결됨';
  }
  if (state === 'connecting') {
    return '연결 중';
  }
  if (state === 'retrying') {
    return '재연결 중';
  }
  if (state === 'disconnected') {
    return '연결 끊김';
  }
  return '대기';
}

function formatCache(value: TcacheRouteJob['cacheStatus']): string {
  return value ? value.toUpperCase() : '-';
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('ko-KR');
}

function formatDistance(value?: number): string {
  if (value === undefined) {
    return '-';
  }
  return value >= 1_000 ? `${(value / 1_000).toFixed(1)}km` : `${value}m`;
}

function formatDuration(value?: number): string {
  if (value === undefined) {
    return '-';
  }
  return value >= 3_600
    ? `${Math.floor(value / 3_600)}시간 ${Math.round((value % 3_600) / 60)}분`
    : `${Math.round(value / 60)}분`;
}

function formatLocation(
  location: TcacheRouteJob['request']['locations'][number],
): string {
  if (location.lat !== undefined && location.lng !== undefined) {
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }
  return location.address ?? '-';
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
