import { useEffect, useRef, type ReactNode } from 'react';
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

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

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
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
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
            if (canClose) {
              onClose();
            }
          }
        }}
      >
        <header className="trip-map-picker-header">
          <h2 id="trip-map-picker-title">내 여행</h2>
          <button
            type="button"
            className="trip-map-picker-close"
            aria-label="여행 선택 닫기"
            title="닫기"
            disabled={!canClose}
            onClick={onClose}
          >
            <Icon>
              <path d="m6 6 12 12M18 6 6 18" />
            </Icon>
          </button>
        </header>

        <div className="trip-map-picker-actions">
          <button
            type="button"
            className="trip-map-picker-action is-primary"
            disabled={busy}
            onClick={onCreate}
          >
            <Icon>
              <path d="M12 5v14M5 12h14" />
            </Icon>
            <span>새 여행 만들기</span>
          </button>
          <button
            type="button"
            className="trip-map-picker-action"
            disabled={busy}
            onClick={onCreateExample}
          >
            <Icon>
              <path d="M4 19V6.5A2.5 2.5 0 0 1 6.5 4H18a1 1 0 0 1 1 1v13" />
              <path d="M6.5 16H19v3.5a1.5 1.5 0 0 1-1.5 1.5h-11A2.5 2.5 0 0 1 4 18.5v0A2.5 2.5 0 0 1 6.5 16Z" />
            </Icon>
            <span>도쿄 예시 여행 만들기</span>
          </button>
          <button
            type="button"
            className="trip-map-picker-action trip-map-picker-refresh"
            aria-label="새로고침"
            title="새로고침"
            disabled={busy}
            onClick={onRefresh}
          >
            <Icon>
              <path d="M20 11A8 8 0 1 0 18.5 16" />
              <path d="M20 5v6h-6" />
            </Icon>
          </button>
        </div>

        {busy && (
          <p className="trip-map-picker-status" role="status">
            여행을 불러오고 있습니다.
          </p>
        )}
        {error && (
          <p className="trip-map-picker-status is-error" role="alert">
            {error}
          </p>
        )}
        {!busy && !error && !trips.length && (
          <p className="trip-map-picker-empty">
            저장된 여행이 없습니다. 첫 여행을 만들어 보세요.
          </p>
        )}

        {!!trips.length && (
          <ul className="trip-map-picker-list">
            {trips.map((trip) => (
              <li key={trip.id} className="trip-map-picker-item">
                <div className="trip-map-picker-item-icon" aria-hidden="true">
                  <Icon>
                    <path d="M20.5 10c0 6-8.5 11-8.5 11s-8.5-5-8.5-11a8.5 8.5 0 0 1 17 0Z" />
                    <circle cx="12" cy="10" r="2.75" />
                  </Icon>
                </div>
                <div className="trip-map-picker-item-body">
                  <strong className="trip-map-picker-item-title">
                    {trip.title}
                  </strong>
                  <span className="trip-map-picker-item-meta">
                    Day {trip.days.length}개 ·{' '}
                    {trip.days.reduce(
                      (count, day) => count + day.places.length,
                      0,
                    )}
                    개 장소
                  </span>
                </div>
                <div className="trip-map-picker-item-actions">
                  <button
                    type="button"
                    className="trip-map-picker-item-open"
                    disabled={busy}
                    onClick={() => onOpen(trip.id)}
                  >
                    열기
                  </button>
                  <button
                    type="button"
                    className="trip-map-picker-item-delete"
                    aria-label={`${trip.title} 삭제`}
                    title="삭제"
                    disabled={busy}
                    onClick={() => onDelete(trip.id)}
                  >
                    <Icon>
                      <path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m2 0v12.5A1.5 1.5 0 0 1 15.5 21h-7A1.5 1.5 0 0 1 7 19.5V7" />
                      <path d="M10 11v6M14 11v6" />
                    </Icon>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
