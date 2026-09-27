import { Classes } from '@blueprintjs/core';
import { memo } from 'react';
import type { TrouteOptimizeResponse } from '@trasolve/shared';
import type { TestbedJob } from '@/entities/route-job';
import { JobResultMapComparison } from '@/features/troute-testbed/components/detail/JobResultMapComparison';
import { useL } from '@/shared/i18n';

export const JobResultSummary = memo(function JobResultSummary({
  job,
  optimization,
}: {
  job: TestbedJob;
  optimization: TrouteOptimizeResponse | null;
}) {
  const L = useL();
  return (
    <section className="route-summary" aria-labelledby="route-title">
      <div className="route-overview">
        <div>
          <h2 id="route-title" className={Classes.HEADING}>
            {L('testbed:jobResultSummary.title.inputVsOptimized')}
          </h2>
          {optimization ? (
            <>
              <span className={Classes.TEXT_MUTED}>
                {L('testbed:jobResultSummary.text.finalRoute')}
              </span>
              <div
                aria-label={L(
                  'testbed:jobResultSummary.ariaLabel.resultsVisitOrder',
                )}
              >
                {optimization.route.map((stop) => stop.location_id).join(' → ')}
              </div>
            </>
          ) : (
            <span className={Classes.TEXT_MUTED}>
              {L(
                'testbed:jobResultSummary.text.compareInputSequenceOptimizationResults',
              )}
            </span>
          )}
        </div>
        {optimization ? (
          <div>
            <span className={Classes.TEXT_MUTED}>
              {L('testbed:jobResultSummary.text.totalTravelTime')}
            </span>
            <strong>
              {L('testbed:jobResultSummary.text.minutes', {
                total_travel_minutes: optimization.total_travel_minutes,
              })}
            </strong>
          </div>
        ) : null}
      </div>
      <JobResultMapComparison job={job} optimization={optimization} />
    </section>
  );
});
