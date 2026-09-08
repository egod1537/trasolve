import type { MapClickEvent, MapPlace } from '../google-map/types';
import type { Endpoint } from './types';
import { Coordinates } from './Coordinates';

function endpointFromPoint(point: MapClickEvent): Endpoint {
  return {
    text: `${point.lat}, ${point.lng}`,
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
  onOriginSelect: (endpoint: Endpoint) => void;
  onDestinationSelect: (endpoint: Endpoint) => void;
};

export function SelectionPanel({
  clicked,
  selectedPlace,
  pending,
  onOriginSelect,
  onDestinationSelect,
}: Props) {
  return (
    <div className="maps-test-selections">
      <section aria-label="Last Map Click">
        <h2>Last Map Click · 선택 좌표</h2>
        {clicked ? (
          <>
            <Coordinates point={clicked} />
            <dl className="maps-test-data">
              <dt>placeId</dt>
              <dd>
                {clicked.placeId ?? '없음 · 장소 아이콘을 클릭해 주세요.'}
              </dd>
            </dl>
            <div className="maps-test-actions">
              <button
                type="button"
                disabled={pending}
                onClick={() => onOriginSelect(endpointFromPoint(clicked))}
              >
                출발지로 설정
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => onDestinationSelect(endpointFromPoint(clicked))}
              >
                도착지로 설정
              </button>
            </div>
          </>
        ) : (
          <p>지도를 클릭하면 좌표를 길찾기에 사용할 수 있습니다.</p>
        )}
      </section>
      <section aria-label="선택한 장소">
        <h2>선택 장소</h2>
        {selectedPlace ? (
          <>
            <dl className="maps-test-data">
              <dt>이름</dt>
              <dd>{selectedPlace.name}</dd>
              <dt>주소</dt>
              <dd>{selectedPlace.address || '제공되지 않음'}</dd>
              {selectedPlace.id && (
                <>
                  <dt>place id</dt>
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
                출발지로 설정
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  onDestinationSelect(endpointFromPlace(selectedPlace))
                }
              >
                도착지로 설정
              </button>
            </div>
          </>
        ) : (
          <p>검색 결과에서 장소를 선택해 주세요.</p>
        )}
      </section>
    </div>
  );
}
