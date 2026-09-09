import { useEffect, useRef } from 'react';
import type { Trip } from '@trasolve/shared';

type Props = {
  trips: readonly Trip[];
  busy: boolean;
  error: string | null;
  canClose: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onCreateExample: () => void;
  onDelete: (id: string) => void;
};

export function TripPickerPopup({
  trips,
  busy,
  error,
  canClose,
  onClose,
  onRefresh,
  onOpen,
  onCreate,
  onCreateExample,
  onDelete,
}: Props) {
  const popupRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    popupRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="trip-map-picker-backdrop">
      <section
        ref={popupRef}
        className="trip-map-picker-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-map-picker-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (canClose) onClose();
          }
        }}
      >
        <header>
          <h2 id="trip-map-picker-title">내 여행</h2>
          <button
            type="button"
            aria-label="여행 선택 닫기"
            disabled={!canClose}
            onClick={onClose}
          >
            X
          </button>
        </header>
        <div className="trip-map-picker-actions">
          <button disabled={busy} onClick={onCreate}>
            새 여행 만들기
          </button>
          <button disabled={busy} onClick={onCreateExample}>
            도쿄 예시 여행 만들기
          </button>
          <button disabled={busy} onClick={onRefresh}>
            새로고침
          </button>
        </div>
        {busy && <p role="status">여행을 불러오고 있습니다.</p>}
        {error && <p role="alert">{error}</p>}
        {!busy && !error && !trips.length && (
          <p>저장된 여행이 없습니다. 첫 여행을 만들어 보세요.</p>
        )}
        <ul>
          {trips.map((trip) => (
            <li key={trip.id}>
              <strong>{trip.title}</strong>
              <div>
                {trip.days.length}일 /{' '}
                {trip.days.reduce((count, day) => count + day.places.length, 0)}
                개 장소
              </div>
              <button disabled={busy} onClick={() => onOpen(trip.id)}>
                열기
              </button>
              <button disabled={busy} onClick={() => onDelete(trip.id)}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
