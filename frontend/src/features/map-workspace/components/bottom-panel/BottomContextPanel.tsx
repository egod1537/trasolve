import type { CSSProperties } from 'react';
import type { TripDay } from '@trasolve/shared';
import '@/features/map-workspace/styles/bottom-context-panel.css';
import { useL } from '@/shared/i18n';

type Props = {
  activeDay: TripDay | null;
};

export function BottomContextPanel({ activeDay }: Props) {
  const L = useL();
  if (!activeDay) {
    return null;
  }

  const subtitle =
    activeDay.date ??
    L('map:bottomContextPanel.text.locations', {
      length: activeDay.places.length,
    });

  return (
    <aside
      className="bottom-context-panel"
      aria-label={L('map:bottomContextPanel.ariaLabel.dayInformation', {
        title: activeDay.title,
      })}
      style={{ '--context-accent': activeDay.color } as CSSProperties}
    >
      <span className="bottom-context-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />
        </svg>
      </span>
      <span className="bottom-context-copy">
        <small>{L('map:bottomContextPanel.label.day')}</small>
        <strong title={activeDay.title}>{activeDay.title}</strong>
        <span>{subtitle}</span>
      </span>
    </aside>
  );
}
