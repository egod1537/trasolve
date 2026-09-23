import { Button, Classes, Intent, Tag } from '@blueprintjs/core';
import type { TrouteOptimizeRequest, TrouteTravelMode } from '@trasolve/shared';
import { memo, useEffect, useMemo, useState } from 'react';
import { JobRequestLocationTable } from '@/features/troute-testbed/components/detail/JobRequestLocationTable';

interface JobRequestSummaryProps {
  request: TrouteOptimizeRequest;
}

const TRAVEL_MODE_LABELS: Record<TrouteTravelMode, string> = {
  TRANSIT: '대중교통',
  DRIVING: '자동차',
  WALKING: '도보',
  BICYCLING: '자전거',
};

export const JobRequestSummary = memo(function JobRequestSummary({
  request,
}: JobRequestSummaryProps) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const travelMode = request.travel_mode ?? 'TRANSIT';
  const json = useMemo(() => JSON.stringify(request, null, 2), [request]);
  const debugEnabled = request.debug !== undefined;
  const shuffleEnabled = request.debug?.shuffle_result_route === true;
  const shuffleSeed = readNumericDebugOption(request.debug, 'shuffle_seed');
  const hasDebugOptions =
    request.debug?.min_job_duration_ms !== undefined ||
    request.debug?.shuffle_result_route !== undefined ||
    shuffleSeed !== undefined;

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <details
      className="job-request-summary"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span className="job-request-summary-title">
          <span className={Classes.HEADING}>요청</span>
          {debugEnabled ? (
            <Tag intent={Intent.PRIMARY} minimal>
              DEBUG
            </Tag>
          ) : null}
          {shuffleEnabled ? (
            <Tag icon="random" intent={Intent.PRIMARY} minimal>
              경로 섞기
            </Tag>
          ) : null}
        </span>
        <span className={Classes.TEXT_MUTED}>
          {expanded ? '접기' : '펼치기'}
        </span>
      </summary>

      <div className="job-request-summary-content">
        <dl className="job-request-facts">
          <div>
            <dt>Job ID</dt>
            <dd className={Classes.MONOSPACE_TEXT}>{request.job_id}</dd>
          </div>
          <div>
            <dt>시작 시간</dt>
            <dd>{request.start_time}</dd>
          </div>
          <div>
            <dt>이동수단</dt>
            <dd>
              {TRAVEL_MODE_LABELS[travelMode]} ({travelMode})
            </dd>
          </div>
          <div>
            <dt>Debug</dt>
            <dd>{debugEnabled ? '사용' : '사용 안 함'}</dd>
          </div>
        </dl>

        {request.debug && hasDebugOptions ? (
          <dl className="job-request-debug-options">
            {request.debug.min_job_duration_ms !== undefined ? (
              <div>
                <dt>최소 실행 시간</dt>
                <dd>{request.debug.min_job_duration_ms}ms</dd>
              </div>
            ) : null}
            {request.debug.shuffle_result_route !== undefined ? (
              <div>
                <dt>경로 결과 섞기</dt>
                <dd>
                  {request.debug.shuffle_result_route ? '사용' : '사용 안 함'}
                </dd>
              </div>
            ) : null}
            {shuffleSeed !== undefined ? (
              <div>
                <dt>Shuffle seed</dt>
                <dd>{shuffleSeed}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {shuffleEnabled ? (
          <p className="job-request-shuffle-note">
            디버그 경로 섞기가 활성화된 Job입니다. 출발지와 도착지는 유지하고
            중간 경유지 결과 순서를 섞습니다.
          </p>
        ) : null}

        <section
          className="job-request-route"
          aria-labelledby="job-request-route-title"
        >
          <h3 id="job-request-route-title" className={Classes.HEADING}>
            입력 경로
          </h3>
          <div aria-label="요청 위치 입력 순서">
            {request.locations.map((location) => location.id).join(' → ')}
          </div>
        </section>

        <JobRequestLocationTable locations={request.locations} />

        <details className="job-request-raw-json">
          <summary>Raw JSON 보기</summary>
          <div>
            <header>
              <span className={Classes.TEXT_MUTED}>저장된 원본 요청</span>
              <Button
                aria-label={copied ? '요청 JSON 복사됨' : '요청 JSON 복사'}
                icon={copied ? 'tick' : 'clipboard'}
                intent={copied ? Intent.SUCCESS : Intent.NONE}
                size="small"
                variant="minimal"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(json)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? '복사됨' : '복사'}
              </Button>
            </header>
            <pre className={`${Classes.CODE_BLOCK} job-request-json-code`}>
              {json}
            </pre>
          </div>
        </details>
      </div>
    </details>
  );
});

function readNumericDebugOption(
  debug: TrouteOptimizeRequest['debug'],
  key: string,
): number | undefined {
  if (!debug) {
    return undefined;
  }
  const value = Object.entries(debug).find(([name]) => name === key)?.[1];
  return typeof value === 'number' ? value : undefined;
}
