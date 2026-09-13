import { useEffect, useMemo, useState } from 'react';
import type { PlaceOpeningHours as PlaceOpeningHoursData } from '@trasolve/shared';
import { getPlaceOpeningStatus } from '../../domain/placeOpeningHours';
import { TimeRangeTimeline } from '../TimeRangeTimeline';

type Props = {
  hours?: PlaceOpeningHoursData;
  loadState?: 'ready' | 'loading' | 'error';
  detailsOpen?: boolean;
  detailsControlId?: string;
  onToggleDetails?: () => void;
};

export function PlaceOpeningHours({
  hours,
  loadState = 'ready',
  detailsOpen = false,
  detailsControlId,
  onToggleDetails,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const status = useMemo(() => getPlaceOpeningStatus(hours, now), [hours, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  if (loadState !== 'ready') {
    return (
      <section className="place-opening-hours is-unknown" aria-label="영업시간">
        <p className="place-opening-status">
          <span className="place-opening-status-dot" aria-hidden="true" />
          <strong>
            {loadState === 'loading'
              ? '영업시간 불러오는 중'
              : '영업시간 정보 없음'}
          </strong>
        </p>
        {loadState === 'error' && (
          <p className="place-opening-explanation">
            장소 영업시간을 불러오지 못했습니다.
          </p>
        )}
      </section>
    );
  }

  const showTodayHours =
    status.type !== 'always-open' && status.type !== 'unknown';
  const timelineTone =
    status.type === 'closing-soon'
      ? 'warning'
      : status.type === 'closed'
        ? 'muted'
        : status.type === 'before-open'
          ? 'primary'
          : 'opening';
  const timelineLabel = status.timelineRanges.length
    ? `오늘 영업시간: ${status.timelineRanges
        .map((range) => `${range.startText}부터 ${range.endText}까지`)
        .join(', ')}`
    : '오늘 영업 구간 없음';

  return (
    <section
      className={`place-opening-hours is-${status.type}`}
      aria-label="영업시간"
    >
      <div className="place-opening-header-row">
        <p className="place-opening-status">
          <span className="place-opening-status-dot" aria-hidden="true" />
          <strong>{status.label}</strong>
        </p>
        {status.weeklyHours.length > 0 && onToggleDetails && (
          <button
            type="button"
            className="place-opening-detail-trigger"
            aria-expanded={detailsOpen}
            aria-controls={detailsControlId}
            aria-label={
              detailsOpen ? '영업시간 상세 닫기' : '영업시간 전체 보기'
            }
            onClick={onToggleDetails}
          >
            영업시간 전체 보기
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        )}
      </div>

      {showTodayHours &&
        (status.todayHours.length <= 1 ? (
          <p className="place-opening-today">
            오늘 {status.todayHours[0] ?? '휴무'}
          </p>
        ) : (
          <div className="place-opening-today is-split">
            <span>오늘</span>
            <ul>
              {status.todayHours.map((range) => (
                <li key={range}>{range}</li>
              ))}
            </ul>
          </div>
        ))}

      {status.type !== 'unknown' && (
        <TimeRangeTimeline
          ranges={status.timelineRanges}
          ariaLabel={timelineLabel}
          tone={timelineTone}
        />
      )}

      {'nextOpenText' in status && status.nextOpenText && (
        <p className="place-opening-next">{status.nextOpenText}</p>
      )}
      {'relativeText' in status && status.relativeText && (
        <p className="place-opening-relative">{status.relativeText}</p>
      )}
      {'explanation' in status && status.explanation && (
        <p className="place-opening-explanation">{status.explanation}</p>
      )}
    </section>
  );
}
