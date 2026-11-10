import { Classes } from '@blueprintjs/core';
import { type TrouteOptimizeResponse } from '@trasolve/shared';
import type { TestbedJob } from '@/entities/route-job';
import {
  createInputComparisonLocations,
  createOptimizedMapContent,
} from '@/features/troute-testbed/components/detail/jobResultMapModel';
import { useL } from '@/shared/i18n';
import { useRequestPlaces } from '@/features/troute-testbed/components/detail/useRequestPlaces';
import { JobComparisonMap } from '@/features/troute-testbed/components/detail/JobComparisonMap';
import {
  LocationSequence,
  MapPlaceholder,
  MapValidationError,
} from '@/features/troute-testbed/components/detail/RequestLocationSequence';

export function JobResultMapComparison({
  job,
  optimization,
}: {
  job: TestbedJob;
  optimization: TrouteOptimizeResponse | null;
}) {
  const L = useL();
  const places = useRequestPlaces(job.request.locations);
  const inputLocations =
    places.status === 'loaded'
      ? createInputComparisonLocations(job.request.locations, places.places)
      : null;
  const optimizedContent = createOptimizedMapContent(
    job.status,
    job.request.locations,
    optimization,
    places.status === 'loaded' ? places.places : null,
  );

  return (
    <>
      <p className="job-result-ordering-line-note">
        {L(
          'testbed:jobResultMapComparison.description.linesComparisonVisitOrderNotActual',
        )}
      </p>
      <div className="job-result-map-comparison">
        <ComparisonPanel
          title={L('testbed:jobResultMapComparison.title.input')}
        >
          {places.status === 'loading' ? (
            <MapPlaceholder
              title={L(
                'testbed:jobResultMapComparison.tooltip.loadingLocationInformation',
              )}
            />
          ) : places.status === 'error' ? (
            <MapValidationError message={places.message} />
          ) : (
            <>
              <JobComparisonMap
                ariaLabel={L(
                  'testbed:jobResultMapComparison.ariaLabel.inputVisitOrderMap',
                )}
                layer="troute-result-input"
                locations={inputLocations ?? []}
              />
              <LocationSequence locations={inputLocations ?? []} />
            </>
          )}
        </ComparisonPanel>

        <ComparisonPanel
          title={L('testbed:jobResultMapComparison.title.optimized')}
        >
          {optimizedContent.kind === 'placeholder' ? (
            <MapPlaceholder title={optimizedContent.message} />
          ) : optimizedContent.kind === 'error' ? (
            <MapValidationError message={optimizedContent.message} />
          ) : places.status === 'loading' ? (
            <MapPlaceholder
              title={L(
                'testbed:jobResultMapComparison.tooltip.loadingLocationInformation',
              )}
            />
          ) : places.status === 'error' ? (
            <MapValidationError message={places.message} />
          ) : (
            <>
              <JobComparisonMap
                ariaLabel={L(
                  'testbed:jobResultMapComparison.ariaLabel.optimizedVisitOrderMap',
                )}
                layer="troute-result-optimized"
                locations={
                  optimizedContent.kind === 'ready'
                    ? optimizedContent.locations
                    : []
                }
              />
              <LocationSequence
                locations={
                  optimizedContent.kind === 'ready'
                    ? optimizedContent.locations
                    : []
                }
                scheduled
              />
            </>
          )}
        </ComparisonPanel>
      </div>
    </>
  );
}

function ComparisonPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const L = useL();
  return (
    <section
      className="job-result-map-panel"
      aria-label={L(
        'testbed:jobResultMapComparison.comparisonPanel.ariaLabel.path',
        { title: title },
      )}
    >
      <header>
        <h3 className={Classes.HEADING}>{title}</h3>
      </header>
      {children}
    </section>
  );
}
