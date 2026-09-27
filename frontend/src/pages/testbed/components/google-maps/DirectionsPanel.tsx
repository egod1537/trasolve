import { useCallback, type FormEvent } from 'react';
import { TravelMode } from '@trasolve/shared';
import type {
  Endpoint,
  IntermediateInput,
} from '@/pages/testbed/components/google-maps/types';
import { useL, L } from '@/shared/i18n';

const modes: { value: TravelMode; label: string }[] = [
  {
    value: TravelMode.DRIVING,
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.car');
    },
  },
  {
    value: TravelMode.WALKING,
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.walk');
    },
  },
  {
    value: TravelMode.TRANSIT,
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.publicTransportation');
    },
  },
  {
    value: TravelMode.BICYCLING,
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.bicycle');
    },
  },
];

function describeEndpoint(endpoint: Endpoint): string {
  const location = endpoint.location;
  if (location?.type === 'place') {
    return L(
      'testbed:directionsPanel.describeEndpoint.text.selectedPlacePlaceid',
      { placeId: location.placeId },
    );
  }
  if (location?.type === 'coordinates') {
    return L('testbed:directionsPanel.describeEndpoint.text.coordinates', {
      lat: location.lat,
      lng: location.lng,
    });
  }
  return L('testbed:directionsPanel.describeEndpoint.text.addressString');
}

type Props = {
  origin: Endpoint;
  intermediates: readonly IntermediateInput[];
  destination: Endpoint;
  travelMode: TravelMode;
  alternatives: boolean;
  pending: boolean;
  canAddIntermediate: boolean;
  onOriginChange: (value: string) => void;
  onIntermediateAdd: () => void;
  onIntermediateChange: (id: number, value: string) => void;
  onIntermediateRemove: (id: number) => void;
  onDestinationChange: (value: string) => void;
  onTravelModeChange: (mode: TravelMode) => void;
  onAlternativesChange: (value: boolean) => void;
  onSubmit: () => void;
};

export function DirectionsPanel({
  origin,
  intermediates,
  destination,
  travelMode,
  alternatives,
  pending,
  canAddIntermediate,
  onOriginChange,
  onIntermediateAdd,
  onIntermediateChange,
  onIntermediateRemove,
  onDestinationChange,
  onTravelModeChange,
  onAlternativesChange,
  onSubmit,
}: Props) {
  const L = useL();
  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit();
    },
    [onSubmit],
  );
  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={pending}>
        <legend>{L('testbed:directionsPanel.label.directions')}</legend>
        <label>
          {L('testbed:jobResultMapComparison.locationSequence.label.departure')}
          <input
            required
            value={origin.text}
            onChange={(event) => onOriginChange(event.target.value)}
          />
          <small>{describeEndpoint(origin)}</small>
        </label>
        {intermediates.map((intermediate, index) => {
          const inputId = `maps-test-intermediate-${intermediate.id}`;
          const descriptionId = `${inputId}-description`;
          return (
            <div className="maps-test-intermediate" key={intermediate.id}>
              <label htmlFor={inputId}>
                {L('testbed:directionsPanel.text.waypoint', {
                  value: index + 1,
                })}
              </label>
              <div className="maps-test-intermediate-row">
                <input
                  id={inputId}
                  value={intermediate.endpoint.text}
                  aria-describedby={descriptionId}
                  onChange={(event) =>
                    onIntermediateChange(intermediate.id, event.target.value)
                  }
                />
                <button
                  type="button"
                  className="maps-test-intermediate-remove"
                  aria-label={L(
                    'testbed:directionsPanel.ariaLabel.deleteWaypoint',
                    { value: index + 1 },
                  )}
                  title={L('testbed:directionsPanel.ariaLabel.deleteWaypoint', {
                    value: index + 1,
                  })}
                  onClick={() => onIntermediateRemove(intermediate.id)}
                >
                  {L('common:action.delete')}
                </button>
              </div>
              <small id={descriptionId}>
                {describeEndpoint(intermediate.endpoint)}
              </small>
            </div>
          );
        })}
        <button
          type="button"
          className="maps-test-intermediate-add"
          disabled={!canAddIntermediate}
          onClick={onIntermediateAdd}
        >
          {L('testbed:directionsPanel.action.addWaypoint')}
        </button>
        <label>
          {L('testbed:jobResultMapComparison.locationSequence.label.arrival')}
          <input
            required
            value={destination.text}
            onChange={(event) => onDestinationChange(event.target.value)}
          />
          <small>{describeEndpoint(destination)}</small>
        </label>
        <label>
          {L('testbed:jobRequestSummary.label.meansTransportation')}
          <select
            value={travelMode}
            onChange={(event) => {
              const mode = modes.find(
                (mode) => mode.value === event.target.value,
              );
              if (mode) {
                onTravelModeChange(mode.value);
              }
            }}
          >
            {modes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </label>
        <label className="maps-test-checkbox">
          <input
            type="checkbox"
            checked={alternatives}
            onChange={(event) => onAlternativesChange(event.target.checked)}
          />
          {L('testbed:tcacheRouteOptions.text.alternateRouteRequest')}
        </label>
        <button
          type="submit"
          disabled={!origin.text.trim() || !destination.text.trim()}
        >
          {pending
            ? L('testbed:directionsPanel.action.requesting')
            : L('testbed:directionsPanel.label.directions')}
        </button>
      </fieldset>
    </form>
  );
}
