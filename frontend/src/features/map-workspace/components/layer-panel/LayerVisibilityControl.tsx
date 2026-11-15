import { useL } from '@/shared/i18n';

type Props = {
  dayCount: number;
  visibleCount: number;
  onToggle: () => void;
};

/** Bulk visibility toggle, using the existing localized label for all items. */
export function LayerVisibilityControl({
  dayCount,
  visibleCount,
  onToggle,
}: Props) {
  const L = useL();
  const anyVisible = visibleCount > 0;
  return (
    <div className="trip-layer-visibility-actions">
      <button
        type="button"
        className="trip-panel-header-action trip-layer-visibility-toggle"
        aria-label={L('admin:common.all')}
        aria-pressed={
          anyVisible && visibleCount < dayCount ? 'mixed' : anyVisible
        }
        disabled={dayCount === 0}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {anyVisible && <path d="m3 3 18 18" />}
        </svg>
        <span>{L('admin:common.all')}</span>
      </button>
    </div>
  );
}
