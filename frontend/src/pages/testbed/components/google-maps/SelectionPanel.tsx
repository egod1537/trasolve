import type { MapClickEvent, MapPlace } from '@/map/types/googleMapComponent';
import type { Endpoint } from '@/pages/testbed/components/google-maps/types';
import { Coordinates } from '@/pages/testbed/components/google-maps/Coordinates';
import { useL, L, NL } from '@/shared/i18n';

function endpointFromPoint(point: MapClickEvent): Endpoint {
  return {
    text: L('testbed:tcacheLocationList.text.message2', {
      lat: point.lat,
      lng: point.lng,
    }),
    location: point.placeId
      ? { type: 'place', placeId: point.placeId }
      : { type: 'coordinates', lat: point.lat, lng: point.lng },
  };
}

function endpointFromPlace(place: MapPlace): Endpoint {
  return {
    text: place.name,
    location: place.id
      ? { type: 'place', placeId: place.id }
      : { type: 'coordinates', ...place.location },
  };
}

type Props = {
  clicked: MapClickEvent | null;
  selectedPlace: MapPlace | null;
  pending: boolean;
  canAddIntermediate: boolean;
  onOriginSelect: (endpoint: Endpoint) => void;
  onIntermediateSelect: (endpoint: Endpoint) => void;
  onDestinationSelect: (endpoint: Endpoint) => void;
};

export function SelectionPanel({
  clicked,
  selectedPlace,
  pending,
  canAddIntermediate,
  onOriginSelect,
  onIntermediateSelect,
  onDestinationSelect,
}: Props) {
  const L = useL();
  return (
    <div className="maps-test-selections">
      <section aria-label={L('testbed:selectionPanel.ariaLabel.lastMapClick')}>
        <h2>
          {L('testbed:selectionPanel.title.lastMapClickSelectCoordinates')}
        </h2>
        {clicked ? (
          <>
            <Coordinates point={clicked} />
            <dl className="maps-test-data">
              <dt>{NL('placeId')}</dt>
              <dd>
                {clicked.placeId ??
                  L('testbed:selectionPanel.text.noneClickLocationIcon')}
              </dd>
            </dl>
            <div className="maps-test-actions">
              <button
                type="button"
                disabled={pending}
                onClick={() => onOriginSelect(endpointFromPoint(clicked))}
              >
                {L('testbed:tcacheRouteMap.action.setAsDeparturePoint')}
              </button>
              <button
                type="button"
                disabled={pending || !canAddIntermediate}
                onClick={() => onIntermediateSelect(endpointFromPoint(clicked))}
              >
                {L('testbed:tcacheRouteMap.action.addAsStopover')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => onDestinationSelect(endpointFromPoint(clicked))}
              >
                {L('testbed:tcacheRouteMap.action.setAsDestination')}
              </button>
            </div>
          </>
        ) : (
          <p>
            {L(
              'testbed:selectionPanel.description.clickMapUseCoordinatesDirections',
            )}
          </p>
        )}
      </section>
      <section
        aria-label={L('testbed:selectionPanel.ariaLabel.selectedLocation')}
      >
        <h2>{L('testbed:selectionPanel.title.placeChoice')}</h2>
        {selectedPlace ? (
          <>
            <dl className="maps-test-data">
              <dt>
                {L(
                  'testbed:jobBuilderLocationList.jobBuilderLocationItem.text.name',
                )}
              </dt>
              <dd>{selectedPlace.name}</dd>
              <dt>{L('testbed:selectionPanel.label.address')}</dt>
              <dd>
                {selectedPlace.address ||
                  L('testbed:routeResultModel.nOTAVAILABLE.text.notProvided')}
              </dd>
              {selectedPlace.id && (
                <>
                  <dt>{L('testbed:selectionPanel.label.placeId')}</dt>
                  <dd>{selectedPlace.id}</dd>
                </>
              )}
            </dl>
            <Coordinates point={selectedPlace.location} />
            <div className="maps-test-actions">
              <button
                type="button"
                disabled={pending}
                onClick={() => onOriginSelect(endpointFromPlace(selectedPlace))}
              >
                {L('testbed:tcacheRouteMap.action.setAsDeparturePoint')}
              </button>
              <button
                type="button"
                disabled={pending || !canAddIntermediate}
                onClick={() =>
                  onIntermediateSelect(endpointFromPlace(selectedPlace))
                }
              >
                {L('testbed:tcacheRouteMap.action.addAsStopover')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  onDestinationSelect(endpointFromPlace(selectedPlace))
                }
              >
                {L('testbed:tcacheRouteMap.action.setAsDestination')}
              </button>
            </div>
          </>
        ) : (
          <p>
            {L(
              'testbed:selectionPanel.description.selectLocationFromSearchResults',
            )}
          </p>
        )}
      </section>
    </div>
  );
}
