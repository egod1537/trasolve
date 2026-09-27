import { Callout, Classes, Intent, NonIdealState } from '@blueprintjs/core';
import {
  placeIdSchema,
  type PlaceDetails,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { useEffect, useRef, useState } from 'react';
import type { TestbedJob } from '@/entities/route-job';
import {
  createInputComparisonLocations,
  createOptimizedMapContent,
  type JobComparisonLocation,
} from '@/features/troute-testbed/components/detail/jobResultMapModel';
import type { MapMarkerHandle } from '@/map/adapters/MapObjectController';
import { GoogleMap, useGoogleMap } from '@/map/components/GoogleMap';
import { useMapPolyline } from '@/map/hooks/useMapPolyline';
import { getPlace } from '@/shared/api/places';
import { useL, L } from '@/shared/i18n';

type RequestLocation = TrouteOptimizeRequest['locations'][number];
type PlaceLoadState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'loaded'; places: ReadonlyMap<string, PlaceDetails> }
  | { key: string; status: 'error'; message: string };

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

function JobComparisonMap({
  ariaLabel,
  layer,
  locations,
}: {
  ariaLabel: string;
  layer: string;
  locations: readonly JobComparisonLocation[];
}) {
  return (
    <GoogleMap
      className="job-result-google-map"
      center={locations[0]?.position ?? { lat: 37.5665, lng: 126.978 }}
      zoom={12}
      ariaLabel={ariaLabel}
      options={{
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      }}
    >
      <JobComparisonViewport locations={locations} />
      <JobComparisonOrderingLine layer={layer} locations={locations} />
      <JobComparisonMarkers layer={layer} locations={locations} />
    </GoogleMap>
  );
}

function JobComparisonOrderingLine({
  layer,
  locations,
}: {
  layer: string;
  locations: readonly JobComparisonLocation[];
}) {
  const { objects } = useGoogleMap();
  useMapPolyline(objects, {
    id: `${layer}:ordering-line`,
    layer: `${layer}-ordering-line`,
    path: locations.map((location) => location.position),
    style: {
      color: '#f59e0b',
      width: 3,
      opacity: 0.78,
      directional: true,
      directionRepeatPx: 96,
      directionScale: 2.6,
    },
    zIndex: 0,
  });
  return null;
}

function JobComparisonViewport({
  locations,
}: {
  locations: readonly JobComparisonLocation[];
}) {
  const { adapter } = useGoogleMap();
  const signature = locations
    .map(
      (location) =>
        `${location.key}:${location.position.lat}:${location.position.lng}`,
    )
    .join('|');

  useEffect(() => {
    if (locations.length === 0) {
      return;
    }
    if (locations.length === 1) {
      adapter.panTo(locations[0]!.position);
      adapter.setZoom(14);
      return;
    }
    const latitudes = locations.map((location) => location.position.lat);
    const longitudes = locations.map((location) => location.position.lng);
    adapter.fitBounds(
      {
        north: Math.max(...latitudes),
        south: Math.min(...latitudes),
        east: Math.max(...longitudes),
        west: Math.min(...longitudes),
      },
      { top: 44, right: 44, bottom: 44, left: 44 },
    );
  }, [adapter, locations, signature]);

  return null;
}

function JobComparisonMarkers({
  layer,
  locations,
}: {
  layer: string;
  locations: readonly JobComparisonLocation[];
}) {
  const { objects } = useGoogleMap();
  const markers = useRef(new Map<string, MapMarkerHandle>());

  useEffect(() => {
    const ownedMarkers = markers.current;
    return () => {
      for (const marker of ownedMarkers.values()) {
        marker.remove();
      }
      ownedMarkers.clear();
    };
  }, [objects]);

  useEffect(() => {
    const remaining = new Set<string>();
    locations.forEach((location, index) => {
      remaining.add(location.key);
      let marker = markers.current.get(location.key);
      if (!marker) {
        marker = objects.addMarker({
          id: `${layer}:${location.key}`,
          layer,
          position: location.position,
        });
        markers.current.set(location.key, marker);
      }
      marker.setPosition(location.position);
      marker.setTitle(`${index + 1}. ${location.name}`);
      marker.setLabel(String(index + 1));
      marker.setSelected(false);
      marker.setZIndex(index + 1);
    });

    for (const [key, marker] of markers.current) {
      if (!remaining.has(key)) {
        marker.remove();
        markers.current.delete(key);
      }
    }
  }, [layer, locations, objects]);

  return null;
}

function LocationSequence({
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

function MapPlaceholder({ title }: { title: string }) {
  return (
    <NonIdealState
      className="job-result-map-placeholder"
      icon="map"
      title={title}
    />
  );
}

function MapValidationError({ message }: { message: string }) {
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

function useRequestPlaces(
  locations: readonly RequestLocation[],
): PlaceLoadState {
  const key = locations
    .map((location) => `${location.id}:${location.place_id}`)
    .join('|');
  const invalidLocations = locations.filter(
    (location) => !placeIdSchema.safeParse(location.place_id).success,
  );
  const invalidMessage =
    invalidLocations.length > 0
      ? L(
          'testbed:jobResultMapComparison.useRequestPlaces.text.mapDisplayRequiresValidPlaceId',
          { value: invalidLocations.map((location) => location.id).join(', ') },
        )
      : null;
  const [state, setState] = useState<PlaceLoadState>({
    key,
    status: 'loading',
  });

  useEffect(() => {
    if (invalidMessage) {
      return;
    }

    const controller = new AbortController();
    const placeIds = [
      ...new Set(locations.map((location) => location.place_id)),
    ];
    void Promise.all(
      placeIds.map(
        async (placeId) =>
          [
            placeId,
            await getPlace(placeId, { signal: controller.signal }),
          ] as const,
      ),
    ).then(
      (entries) => {
        if (!controller.signal.aborted) {
          setState({ key, status: 'loaded', places: new Map(entries) });
        }
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            status: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : L(
                    'testbed:jobResultMapComparison.useRequestPlaces.message.failedLoadLocationCoordinates',
                  ),
          });
        }
      },
    );
    return () => controller.abort();
  }, [invalidMessage, key, locations]);

  if (invalidMessage) {
    return { key, status: 'error', message: invalidMessage };
  }
  return state.key === key ? state : { key, status: 'loading' };
}
