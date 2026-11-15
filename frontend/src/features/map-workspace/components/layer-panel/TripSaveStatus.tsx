import { useTripState } from '@/features/map-workspace/hooks/useTrip';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { getLanguage, useL, L } from '@/shared/i18n';

function formatSavedAt(value: string): { label: string; title: string } {
  const savedAt = new Date(value);
  if (Number.isNaN(savedAt.getTime())) {
    return {
      label: L('map:layerPanelHeader.formatSavedAt.label.saved'),
      title: value,
    };
  }

  const now = new Date();
  const sameDay =
    savedAt.getFullYear() === now.getFullYear() &&
    savedAt.getMonth() === now.getMonth() &&
    savedAt.getDate() === now.getDate();
  const time = `${String(savedAt.getHours()).padStart(2, '0')}:${String(
    savedAt.getMinutes(),
  ).padStart(2, '0')}`;
  const date = `${savedAt.getMonth() + 1}/${savedAt.getDate()}`;

  return {
    label: L('map:layerPanelHeader.formatSavedAt.label.lastSaved', {
      value: sameDay
        ? time
        : L('map:layerPanelHeader.formatSavedAt.label.message', {
            date: date,
            time: time,
          }),
    }),
    title: new Intl.DateTimeFormat(getLanguage(), {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(savedAt),
  };
}

export function TripSaveStatus() {
  const { trip, status: saveStatus } = useTripState();
  const L = useL();
  const saved = formatSavedAt(trip.updatedAt);
  const saveLabel =
    saveStatus === 'saving'
      ? L('map:layerPanelHeader.saveLabel.text.saving')
      : saveStatus === 'error'
        ? L('map:layerPanelHeader.saveLabel.text.saveFailed')
        : saveStatus === 'dirty'
          ? L('map:layerPanelHeader.saveLabel.text.waitingSave')
          : saved.label;
  return (
    <p
      className={`trip-last-saved is-${saveStatus}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      title={saveStatus === 'ready' ? saved.title : undefined}
    >
      {(saveStatus === 'dirty' || saveStatus === 'saving') && (
        <span
          className={`trip-save-status-spinner${saveStatus === 'dirty' ? ' is-dirty' : ''}`}
          aria-hidden="true"
        >
          <LoadingSpinner size="sm" />
        </span>
      )}
      <span
        className={saveStatus === 'dirty' ? 'sr-only' : 'trip-last-saved-label'}
      >
        {saveLabel}
      </span>
    </p>
  );
}
