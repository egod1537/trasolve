import type { CSSProperties } from 'react';
import type { TripDay } from '@trasolve/shared';
import '../../styles/bottom-context-panel.css';

type Props = {
  activeDay: TripDay | null;
};

export function BottomContextPanel({ activeDay }: Props) {
  if (!activeDay) return null;

  const subtitle = activeDay.date ?? `${activeDay.places.length}개 장소`;

  return (
    <aside
      className="bottom-context-panel"
      aria-label={`${activeDay.title} Day 정보`}
      style={{ '--context-accent': activeDay.color } as CSSProperties}
    >
      <span className="bottom-context-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
        </svg>
      </span>
      <span className="bottom-context-copy">
        <small>Day</small>
        <strong title={activeDay.title}>{activeDay.title}</strong>
        <span>{subtitle}</span>
      </span>
    </aside>
  );
}
