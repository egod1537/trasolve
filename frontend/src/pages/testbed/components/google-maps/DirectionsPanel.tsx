import { useCallback, type FormEvent } from 'react';
import { TravelMode } from '@trasolve/shared';
import type { Endpoint, IntermediateInput } from './types';

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
        {intermediates.map((intermediate, index) => {
          const inputId = `maps-test-intermediate-${intermediate.id}`;
          const descriptionId = `${inputId}-description`;
          return (
            <div className="maps-test-intermediate" key={intermediate.id}>
              <label htmlFor={inputId}>경유지 {index + 1}</label>
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
                  aria-label={`경유지 ${index + 1} 삭제`}
                  title={`경유지 ${index + 1} 삭제`}
                  onClick={() => onIntermediateRemove(intermediate.id)}
                >
                  삭제
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
          + 경유지 추가
        </button>
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
