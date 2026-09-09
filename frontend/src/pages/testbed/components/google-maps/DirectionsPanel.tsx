import { useCallback, type FormEvent } from 'react';
import { TravelMode } from '@trasolve/shared';
import type { Endpoint } from './types';

const modes: { value: TravelMode; label: string }[] = [
  { value: TravelMode.DRIVING, label: '자동차' },
  { value: TravelMode.WALKING, label: '도보' },
  { value: TravelMode.TRANSIT, label: '대중교통' },
  { value: TravelMode.BICYCLING, label: '자전거' },
];

function describeEndpoint(endpoint: Endpoint): string {
  const location = endpoint.location;
  if (location?.type === 'place')
    return `선택한 장소 · placeId: ${location.placeId}`;
  if (location?.type === 'coordinates')
    return `좌표: ${location.lat}, ${location.lng}`;
  return '주소 문자열';
}

type Props = {
  origin: Endpoint;
  destination: Endpoint;
  travelMode: TravelMode;
  alternatives: boolean;
  pending: boolean;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onTravelModeChange: (mode: TravelMode) => void;
  onAlternativesChange: (value: boolean) => void;
  onSubmit: () => void;
};

export function DirectionsPanel({
  origin,
  destination,
  travelMode,
  alternatives,
  pending,
  onOriginChange,
  onDestinationChange,
  onTravelModeChange,
  onAlternativesChange,
  onSubmit,
}: Props) {
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
        <legend>길찾기</legend>
        <label>
          출발지
          <input
            required
            value={origin.text}
            onChange={(event) => onOriginChange(event.target.value)}
          />
          <small>{describeEndpoint(origin)}</small>
        </label>
        <label>
          도착지
          <input
            required
            value={destination.text}
            onChange={(event) => onDestinationChange(event.target.value)}
          />
          <small>{describeEndpoint(destination)}</small>
        </label>
        <label>
          이동수단
          <select
            value={travelMode}
            onChange={(event) => {
              const mode = modes.find(
                (mode) => mode.value === event.target.value,
              );
              if (mode) onTravelModeChange(mode.value);
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
          대체 경로 요청
        </label>
        <button
          type="submit"
          disabled={!origin.text.trim() || !destination.text.trim()}
        >
          {pending ? '요청 중…' : '길찾기'}
        </button>
      </fieldset>
    </form>
  );
}
