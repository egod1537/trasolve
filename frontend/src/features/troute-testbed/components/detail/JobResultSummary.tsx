import { Classes } from '@blueprintjs/core';
import { memo } from 'react';
import type { TrouteOptimizeResponse } from '@trasolve/shared';
import type { TestbedJob } from '@/entities/route-job';
import { JobResultMapComparison } from '@/features/troute-testbed/components/detail/JobResultMapComparison';

export const JobResultSummary = memo(function JobResultSummary({
  job,
  optimization,
}: {
  job: TestbedJob;
  optimization: TrouteOptimizeResponse | null;
}) {
  return (
    <section className="route-summary" aria-labelledby="route-title">
      <div className="route-overview">
        <div>
          <h2 id="route-title" className={Classes.HEADING}>
            Input vs Optimized
          </h2>
          {optimization ? (
            <>
              <span className={Classes.TEXT_MUTED}>최종 경로</span>
              <div aria-label="결과 방문 순서">
                {optimization.route.map((stop) => stop.location_id).join(' → ')}
              </div>
            </>
          ) : (
            <span className={Classes.TEXT_MUTED}>
              입력 순서와 최적화 결과를 비교합니다.
            </span>
          )}
        </div>
        {optimization ? (
          <div>
            <span className={Classes.TEXT_MUTED}>총 이동 시간</span>
            <strong>{optimization.total_travel_minutes}분</strong>
          </div>
        ) : null}
      </div>
      <JobResultMapComparison job={job} optimization={optimization} />
    </section>
  );
});
