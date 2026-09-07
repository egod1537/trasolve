import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import {
  orderedPlaces,
  type Trip,
  type TripDay,
  type TripPlace,
} from '../../types/trip';

type SelectionProps = {
  selectedPlaceId: string | null;
  selectedDayId: string | null;
  onSelectPlace: (id: string) => void;
  onSelectDay: (id: string) => void;
};

function PlaceListItem({
  place,
  selected,
  onSelect,
}: {
  place: TripPlace;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li data-place-id={place.id}>
      <button
        type="button"
        className={`trip-place${selected ? ' is-selected' : ''}`}
        aria-pressed={selected}
        onClick={() => onSelect(place.id)}
      >
        <span className="trip-place-order" aria-hidden="true">
          {place.order}
        </span>
        <span className="trip-place-content">
          <span className="trip-place-name">{place.name}</span>
          <span className="trip-place-description">{place.description}</span>
        </span>
        {place.time && <time className="trip-place-time">{place.time}</time>}
      </button>
    </li>
  );
}

function DaySection({
  day,
  expanded,
  onToggle,
  selectedDayId,
  selectedPlaceId,
  onSelectDay,
  onSelectPlace,
}: SelectionProps & {
  day: TripDay;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      className={`trip-day${selectedDayId === day.id ? ' is-active' : ''}`}
      style={{ '--day-color': day.color } as CSSProperties}
      aria-labelledby={`title-${day.id}`}
    >
      <div className="trip-day-heading">
        <h2 id={`title-${day.id}`}>
          <button
            type="button"
            onClick={() => onSelectDay(day.id)}
            aria-pressed={selectedDayId === day.id}
          >
            <span className="trip-day-color" aria-hidden="true" />
            {day.title}
            <span className="trip-day-date">{day.date}</span>
          </button>
        </h2>
        <button
          className="trip-day-toggle"
          type="button"
          aria-expanded={expanded}
          aria-controls={`places-${day.id}`}
          aria-label={`${day.title} ${expanded ? '접기' : '펼치기'}`}
          onClick={onToggle}
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            style={{ transform: expanded ? undefined : 'rotate(-90deg)' }}
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
      </div>
      <ol
        id={`places-${day.id}`}
        className="trip-place-list"
        hidden={!expanded}
      >
        {orderedPlaces(day).map((place) => (
          <PlaceListItem
            key={place.id}
            place={place}
            selected={selectedPlaceId === place.id}
            onSelect={onSelectPlace}
          />
        ))}
        {!day.places.length && (
          <li className="trip-empty-day">등록된 장소가 없습니다.</li>
        )}
      </ol>
    </section>
  );
}

export function TripSidebar({
  trip,
  sidebarRef,
  onShowAll,
  selectionRevision,
  ...selection
}: SelectionProps & {
  trip: Trip;
  sidebarRef: RefObject<HTMLElement | null>;
  onShowAll: () => void;
  selectionRevision: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const { selectedPlaceId } = selection;
  const selectedDay = trip.days.find((day) =>
    day.places.some((place) => place.id === selectedPlaceId),
  );

  useEffect(() => {
    if (!selectedDay || !selectedPlaceId) return;
    setCollapsed((previous) => {
      if (!previous.has(selectedDay.id)) return previous;
      const next = new Set(previous);
      next.delete(selectedDay.id);
      return next;
    });
  }, [selectedDay, selectedPlaceId, selectionRevision]);

  useEffect(() => {
    if (!selectedPlaceId) return;
    const panel = scrollRef.current;
    const item = Array.from(
      panel?.querySelectorAll<HTMLElement>('[data-place-id]') ?? [],
    ).find((element) => element.dataset.placeId === selectedPlaceId);
    if (!panel || !item) return;
    const outer = panel.getBoundingClientRect(),
      inner = item.getBoundingClientRect();
    if (inner.top < outer.top) panel.scrollTop += inner.top - outer.top;
    else if (inner.bottom > outer.bottom)
      panel.scrollTop += inner.bottom - outer.bottom;
  }, [selectedPlaceId, collapsed, selectionRevision]);

  return (
    <aside ref={sidebarRef} className="trip-sidebar" aria-label="여행 일정">
      <div className="trip-sidebar-header">
        <a className="trip-home" href="/">
          ← Trasolve
        </a>
        <p className="trip-sample-label">예시 일정</p>
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
      <div className="trip-sidebar-scroll" ref={scrollRef}>
        {trip.days.map((day) => (
          <DaySection
            key={day.id}
            day={day}
            expanded={!collapsed.has(day.id)}
            onToggle={() =>
              setCollapsed((previous) => {
                const next = new Set(previous);
                if (next.has(day.id)) next.delete(day.id);
                else next.add(day.id);
                return next;
              })
            }
            {...selection}
          />
        ))}
        {!trip.days.length && (
          <p className="trip-empty-day">아직 여행 일정이 없습니다.</p>
        )}
      </div>
      <p className="trip-sidebar-note">
        지도 선은 방문 순서를 나타냅니다.
        <br />
        실제 이동 경로와는 다를 수 있습니다.
      </p>
    </aside>
  );
}
