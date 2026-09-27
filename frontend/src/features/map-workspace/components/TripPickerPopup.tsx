import { useId, useState } from 'react';
import type { Trip } from '@trasolve/shared';
import { PreferencesModal } from '@/features/preferences/ui/PreferencesModal';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { IconButton } from '@/shared/ui/IconButton';
import {
  BookIcon,
  CloseIcon,
  GearIcon,
  LocationIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from '@/shared/ui/icons';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { useL } from '@/shared/i18n';

type Props = {
  trips: readonly Trip[];
  busy: boolean;
  error: string | null;
  authenticationStatus: 'loading' | 'signed-out' | 'signed-in';
  canClose: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onCreateExample: () => void;
  onDelete: (id: string) => void;
  onLogin: () => void;
};

export function TripPickerPopup({
  trips,
  busy,
  error,
  authenticationStatus,
  canClose,
  onClose,
  onRefresh,
  onOpen,
  onCreate,
  onCreateExample,
  onDelete,
  onLogin,
}: Props) {
  const L = useL();
  const titleId = useId();
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  if (preferencesOpen) {
    return <PreferencesModal onClose={() => setPreferencesOpen(false)} />;
  }

  return (
    <Dialog
      className="trip-map-picker-popup"
      backdropClassName="trip-map-picker-backdrop"
      labelledBy={titleId}
      closeOnBackdrop={false}
      closeOnEscape={canClose}
      onClose={onClose}
    >
      <header className="trip-map-picker-header">
        <h2 id={titleId}>{L('trip:tripPickerPopup.title.myTrip')}</h2>
        <div className="trip-map-picker-header-actions">
          <IconButton
            className="trip-map-picker-close"
            aria-label={L('auth:mapUserControls.text.preferences')}
            title={L('auth:mapUserControls.text.preferences')}
            aria-haspopup="dialog"
            variant="ghost"
            size="sm"
            icon={<GearIcon />}
            onClick={() => setPreferencesOpen(true)}
          />
          <IconButton
            className="trip-map-picker-close"
            aria-label={L(
              'trip:tripPickerPopup.ariaLabel.closeTravelSelection',
            )}
            title={L('common:action.close')}
            variant="ghost"
            size="sm"
            icon={<CloseIcon />}
            disabled={!canClose}
            onClick={onClose}
          />
        </div>
      </header>

      {authenticationStatus === 'signed-out' ? (
        <div className="trip-map-picker-actions">
          <Button
            className="trip-map-picker-action is-primary"
            variant="primary"
            onClick={onLogin}
          >
            {L('auth:mapUserControls.text.signGoogle')}
          </Button>
        </div>
      ) : authenticationStatus === 'signed-in' ? (
        <div className="trip-map-picker-actions">
          <Button
            className="trip-map-picker-action is-primary"
            variant="primary"
            disabled={busy}
            startIcon={<PlusIcon />}
            onClick={onCreate}
          >
            <span>{L('trip:tripPickerPopup.text.createNewTrip')}</span>
          </Button>
          <Button
            className="trip-map-picker-action"
            disabled={busy}
            startIcon={<BookIcon />}
            onClick={onCreateExample}
          >
            <span>{L('trip:tripPickerPopup.text.createExampleTripTokyo')}</span>
          </Button>
          <IconButton
            className="trip-map-picker-action trip-map-picker-refresh"
            aria-label={L('common:action.refresh')}
            title={L('common:action.refresh')}
            variant="secondary"
            size="sm"
            icon={<RefreshIcon />}
            loading={busy}
            disabled={busy}
            onClick={onRefresh}
          />
        </div>
      ) : null}

      {authenticationStatus === 'signed-out' && !error && (
        <p className="trip-map-picker-status" role="status">
          {L('auth:mapUserControls.text.signGoogleAccount')}
        </p>
      )}

      {busy && (
        <p className="trip-map-picker-status" role="status">
          <LoadingSpinner />
          {L('trip:tripPickerPopup.description.itSBringingYouTravel')}
        </p>
      )}
      {error && (
        <p className="trip-map-picker-status is-error" role="alert">
          {error}
        </p>
      )}
      {authenticationStatus === 'signed-in' &&
        !busy &&
        !error &&
        !trips.length && (
          <EmptyState
            className="trip-map-picker-empty"
            title={L('trip:tripPickerPopup.tooltip.thereNoSavedTrips')}
            description={L('trip:tripPickerPopup.text.makeFirstTrip')}
          />
        )}

      {authenticationStatus === 'signed-in' && !!trips.length && (
        <ul className="trip-map-picker-list">
          {trips.map((trip) => (
            <li key={trip.id} className="trip-map-picker-item">
              <div className="trip-map-picker-item-icon" aria-hidden="true">
                <LocationIcon />
              </div>
              <div className="trip-map-picker-item-body">
                <strong className="trip-map-picker-item-title">
                  {trip.title}
                </strong>
                <span className="trip-map-picker-item-meta">
                  {L('trip:tripPickerPopup.text.daysLocations', {
                    dayCount: trip.days.length,
                    placeCount: trip.days.reduce(
                      (count, day) => count + day.places.length,
                      0,
                    ),
                  })}
                </span>
              </div>
              <div className="trip-map-picker-item-actions">
                <Button
                  className="trip-map-picker-item-open"
                  size="sm"
                  disabled={busy}
                  onClick={() => onOpen(trip.id)}
                >
                  {L('trip:tripPickerPopup.action.open')}
                </Button>
                <IconButton
                  className="trip-map-picker-item-delete"
                  aria-label={L('trip:tripPickerPopup.ariaLabel.delete', {
                    title: trip.title,
                  })}
                  title={L('common:action.delete')}
                  variant="ghost"
                  size="sm"
                  icon={<TrashIcon />}
                  disabled={busy}
                  onClick={() => onDelete(trip.id)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
