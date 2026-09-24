import type { TripPlace } from '@trasolve/shared';
import type { ReactNode } from 'react';
import { PlaceTimeTimeline } from '@/features/place-editor';
import type { RouteOptimizationSchedule } from '@/features/route-optimization/model/routeOptimization';

type Props =
  | {
      variant: 'before';
      places: readonly TripPlace[];
    }
  | {
      variant: 'after';
      places: readonly TripPlace[];
      schedule: RouteOptimizationSchedule | null;
      running: boolean;
      hasResult: boolean;
    };

export function RouteSchedulePreview(props: Props) {
  return props.variant === 'before' ? (
    <BeforeSchedule places={props.places} />
  ) : (
    <AfterSchedule
      places={props.places}
      schedule={props.schedule}
      running={props.running}
      hasResult={props.hasResult}
    />
  );
}

function BeforeSchedule({ places }: { places: readonly TripPlace[] }) {
  return (
    <SchedulePanel title="일정" description="현재 일정">
      <ol className="route-optimization-schedule-list">
        {places.map((place, index) => {
          const stayMinutes = getStayMinutes(place);
          const departureTime = place.time
            ? addMinutes(place.time, stayMinutes)
            : null;
          const nextPlace = places[index + 1];
          const intervalMinutes =
            departureTime && nextPlace?.time
              ? getForwardMinutes(departureTime, nextPlace.time)
              : null;
          return (
            <li key={place.id}>
              <SchedulePlace
                index={index}
                place={place}
                time={place.time ?? null}
                departureTime={departureTime}
                stayMinutes={stayMinutes}
              />
              {nextPlace ? (
                <ScheduleLeg label="다음 일정까지" minutes={intervalMinutes} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </SchedulePanel>
  );
}

function AfterSchedule({
  places,
  schedule,
  running,
  hasResult,
}: {
  places: readonly TripPlace[];
  schedule: RouteOptimizationSchedule | null;
  running: boolean;
  hasResult: boolean;
}) {
  if (!schedule) {
    return (
      <SchedulePanel title="일정" description="최적화 일정">
        <p
          className={`route-optimization-schedule-placeholder${running ? ' is-running' : ''}`}
          role="status"
        >
          {running
            ? '최적화된 일정을 계산하고 있습니다.'
            : hasResult
              ? '결과의 일정 정보가 방문 순서와 일치하지 않아 미리보기를 만들 수 없습니다.'
              : '최적화를 실행하면 장소별 방문 일정을 확인할 수 있습니다.'}
        </p>
      </SchedulePanel>
    );
  }

  const placesById = new Map(places.map((place) => [place.id, place]));
  return (
    <SchedulePanel title="일정" description="최적화 일정">
      <ol className="route-optimization-schedule-list">
        {schedule.stops.map((stop, index) => {
          const place = placesById.get(stop.placeId);
          if (!place) {
            return null;
          }
          return (
            <li key={stop.placeId}>
              {index > 0 ? (
                <ScheduleLeg
                  label="이동"
                  minutes={stop.travelMinutesFromPrevious}
                />
              ) : null}
              <SchedulePlace
                index={index}
                place={place}
                time={stop.serviceStartTime}
                arrivalTime={stop.arrivalTime}
                departureTime={stop.departureTime}
                waitMinutes={stop.waitMinutes}
                stayMinutes={stop.stayMinutes}
              />
            </li>
          );
        })}
      </ol>
    </SchedulePanel>
  );
}

function SchedulePanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="route-optimization-schedule-panel">
      <header>
        <strong>{title}</strong>
        <span>{description}</span>
      </header>
      {children}
    </article>
  );
}

function SchedulePlace({
  index,
  place,
  time,
  arrivalTime,
  departureTime,
  waitMinutes,
  stayMinutes,
}: {
  index: number;
  place: TripPlace;
  time: string | null;
  arrivalTime?: string;
  departureTime: string | null;
  waitMinutes?: number;
  stayMinutes: number;
}) {
  return (
    <div className="route-optimization-schedule-stop">
      <span className="route-optimization-schedule-index">{index + 1}</span>
      <div className="route-optimization-schedule-place">
        <div className="route-optimization-schedule-place-heading">
          <strong>{place.name}</strong>
          <span>
            {time && departureTime
              ? `${time} ~ ${departureTime}`
              : '시간 미설정'}
          </span>
        </div>
        {time ? (
          <PlaceTimeTimeline
            time={time}
            visitDurationMinutes={stayMinutes}
            variant="compact"
          />
        ) : null}
        <div className="route-optimization-schedule-meta">
          {arrivalTime ? <span>도착 {arrivalTime}</span> : null}
          {waitMinutes !== undefined ? <span>대기 {waitMinutes}분</span> : null}
          <span>체류 {stayMinutes}분</span>
          {departureTime ? <span>출발 {departureTime}</span> : null}
        </div>
      </div>
    </div>
  );
}

function ScheduleLeg({
  label,
  minutes,
}: {
  label: string;
  minutes: number | null;
}) {
  return (
    <div className="route-optimization-schedule-leg">
      <span aria-hidden="true" />
      <strong>{label}</strong>
      <span>{minutes === null ? '시간 정보 없음' : `${minutes}분`}</span>
    </div>
  );
}

function getStayMinutes(place: TripPlace): number {
  return place.visitDurationMinutes ?? place.preferredDurationMinutes ?? 0;
}

function addMinutes(time: string, minutes: number): string | null {
  const total = clockToMinutes(time) + minutes;
  if (total < 0 || total >= 24 * 60) {
    return null;
  }
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60,
  ).padStart(2, '0')}`;
}

function getForwardMinutes(from: string, to: string): number | null {
  const difference = clockToMinutes(to) - clockToMinutes(from);
  return difference >= 0 ? difference : null;
}

function clockToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
