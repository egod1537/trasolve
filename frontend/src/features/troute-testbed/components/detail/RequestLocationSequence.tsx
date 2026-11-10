import { Callout, Intent, NonIdealState } from '@blueprintjs/core';
import { type JobComparisonLocation } from '@/features/troute-testbed/components/detail/jobResultMapModel';
import { useL, L } from '@/shared/i18n';

export function LocationSequence({
  locations,
  scheduled = false,
}: {
  locations: readonly JobComparisonLocation[];
  scheduled?: boolean;
}) {
  return (
    <ol className="job-result-location-sequence">
      {locations.map((location, index) => (
        <li key={location.key}>
          <span className="job-result-location-order">{index + 1}</span>
          <div className="job-result-location-copy">
            <strong>{location.name}</strong>
            <code>{location.request.id}</code>
          </div>
          <dl>
            {scheduled ? (
              <>
                <div>
                  <dt>
                    {L(
                      'testbed:jobResultMapComparison.locationSequence.label.arrival',
                    )}
                  </dt>
                  <dd>{location.stop?.arrival_time ?? '—'}</dd>
                </div>
                <div>
                  <dt>
                    {L(
                      'testbed:jobResultMapComparison.locationSequence.label.departure',
                    )}
                  </dt>
                  <dd>{location.stop?.departure_time ?? '—'}</dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>{L('testbed:jobRequestLocationTable.text.stay')}</dt>
              <dd>
                {L('testbed:jobRequestLocationTable.text.minutes2', {
                  stay_minutes: location.request.stay_minutes,
                })}
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ol>
  );
}

export function MapPlaceholder({ title }: { title: string }) {
  return (
    <NonIdealState
      className="job-result-map-placeholder"
      icon="map"
      title={title}
    />
  );
}

export function MapValidationError({ message }: { message: string }) {
  const L = useL();
  return (
    <div className="job-result-map-placeholder">
      <Callout
        compact
        intent={Intent.DANGER}
        role="alert"
        title={L(
          'testbed:jobResultMapComparison.mapValidationError.tooltip.mapValidationError',
        )}
      >
        {message}
      </Callout>
    </div>
  );
}
