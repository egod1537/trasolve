import type { Trip } from '../../domain/trip';

type Props = { trip: Trip; onShowAll: () => void };

export function LayerPanelHeader({ trip, onShowAll }: Props) {
  return (
    <div className="trip-sidebar-header">
      <a className="trip-home" href="/">
        ← Trasolve
      </a>
      <p className="trip-sample-label">여행 일정</p>
      <h1>{trip.title}</h1>
      <p className="trip-period">{trip.period}</p>
      <div className="trip-overview">
        <span>
          {trip.days.length}일 ·{' '}
          {trip.days.reduce((total, day) => total + day.places.length, 0)}개
          장소
        </span>
        <button type="button" onClick={onShowAll}>
          전체 일정 보기
        </button>
      </div>
    </div>
  );
}
