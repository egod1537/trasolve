import { useCallback, type FormEvent } from 'react';
import type { TravelMode } from '../../maps/googleDirections';
import type { Endpoint } from './types';

const modes: { value: TravelMode; label: string }[] = [
  { value: 'DRIVING', label: '자동차' },
  { value: 'WALKING', label: '도보' },
  { value: 'TRANSIT', label: '대중교통' },
  { value: 'BICYCLING', label: '자전거' },
];

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
          <small>
            {origin.location
              ? `좌표: ${origin.location.lat}, ${origin.location.lng}`
              : '주소 문자열'}
          </small>
        </label>
        <label>
          도착지
          <input
            required
            value={destination.text}
            onChange={(event) => onDestinationChange(event.target.value)}
          />
          <small>
            {destination.location
              ? `좌표: ${destination.location.lat}, ${destination.location.lng}`
              : '주소 문자열'}
          </small>
        </label>
        <label>
          이동수단
          <select
            value={travelMode}
            onChange={(event) =>
              onTravelModeChange(event.target.value as TravelMode)
            }
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
