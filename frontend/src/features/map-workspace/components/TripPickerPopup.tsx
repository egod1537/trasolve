import { useId, useState } from 'react';
import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type AnalyticsEventMetadata,
  type AnalyticsTarget,
  type Trip,
} from '@trasolve/shared';
import { PreferencesModal } from '@/features/preferences/ui/PreferencesModal';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { IconButton } from '@/shared/ui/IconButton';
import {
  BookIcon,
  CloseIcon,
  GearIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from '@/shared/ui/icons';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { getLanguage, useL } from '@/shared/i18n';
import type { MapWorkspaceMode } from '@/features/map-workspace/model/mapWorkspaceMode';
import { trackEvent, useScreenView } from '@/shared/analytics';
import { TripStaticMapPreview } from '@/features/map-workspace/components/TripStaticMapPreview';
import { TripListCard } from '@/features/map-workspace/components/TripListCard';

function TripUpdatedAt({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return (
    <>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
      <time dateTime={value}>
        {new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium' }).format(
          date,
        )}
      </time>
    </>
  );
}

type CommonProps = {
  mode: MapWorkspaceMode;
  trips: readonly Trip[];
  busy: boolean;
  error: string | null;
  authenticationStatus: 'loading' | 'signed-out' | 'signed-in';
  canClose: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onLogin: () => void;
};

type Props = CommonProps &
  (
    | {
        mode: 'edit';
        onCreate: () => void;
        onCreateSeoulExample: () => void;
        onCreateTokyoExample: () => void;
        onDelete: (id: string) => void;
      }
    | {
        mode: 'readonly';
        onCreate?: never;
        onCreateSeoulExample?: never;
        onCreateTokyoExample?: never;
        onDelete?: never;
      }
  );

export function TripPickerPopup({
  mode,
  trips,
  busy,
  error,
  authenticationStatus,
  canClose,
  onClose,
  onRefresh,
  onOpen,
  onCreate,
  onCreateSeoulExample,
  onCreateTokyoExample,
  onDelete,
  onLogin,
}: Props) {
  const L = useL();
  const titleId = useId();
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  useScreenView(ANALYTICS_SCREENS.tripPicker);

  const trackPickerButton = (
    target: AnalyticsTarget,
    source?: AnalyticsEventMetadata['source'],
  ): void => {
    trackEvent({
      eventType: 'button_click',
      screen: ANALYTICS_SCREENS.tripPicker,
      target,
      metadata: source ? { source } : null,
    });
  };

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
            data-analytics-id={ANALYTICS_TARGETS.preferencesOpen}
            data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
            aria-label={L('auth:mapUserControls.text.preferences')}
            title={L('auth:mapUserControls.text.preferences')}
            aria-haspopup="dialog"
            variant="ghost"
            size="sm"
            icon={<GearIcon />}
            onClick={() => {
              trackPickerButton(ANALYTICS_TARGETS.preferencesOpen);
              setPreferencesOpen(true);
            }}
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
            data-analytics-id={ANALYTICS_TARGETS.tripPickerLogin}
            data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
            variant="primary"
            onClick={() => {
              trackPickerButton(ANALYTICS_TARGETS.tripPickerLogin);
              onLogin();
            }}
          >
            {L('auth:mapUserControls.text.signGoogle')}
          </Button>
        </div>
      ) : authenticationStatus === 'signed-in' && mode === 'edit' ? (
        <div className="trip-map-picker-actions">
          <Button
            className="trip-map-picker-action is-primary"
            data-analytics-id={ANALYTICS_TARGETS.tripCreate}
            data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
            variant="primary"
            disabled={busy}
            startIcon={<PlusIcon />}
            onClick={() => {
              trackPickerButton(ANALYTICS_TARGETS.tripCreate, 'blank');
              onCreate?.();
            }}
          >
            <span>{L('trip:tripPickerPopup.text.createNewTrip')}</span>
          </Button>
          <Button
            className="trip-map-picker-action"
            data-analytics-id={ANALYTICS_TARGETS.tripCreate}
            data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
            aria-label={L('trip:tripPickerPopup.text.createExampleTripSeoul')}
            disabled={busy}
            startIcon={<BookIcon />}
            onClick={() => {
              trackPickerButton(ANALYTICS_TARGETS.tripCreate, 'seoul_example');
              onCreateSeoulExample?.();
            }}
          >
            <span>{L('trip:tripPickerPopup.text.createExampleTripSeoul')}</span>
          </Button>
          <Button
            className="trip-map-picker-action"
            data-analytics-id={ANALYTICS_TARGETS.tripCreate}
            data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
            aria-label={L('trip:tripPickerPopup.text.createExampleTripTokyo')}
            disabled={busy}
            startIcon={<BookIcon />}
            onClick={() => {
              trackPickerButton(ANALYTICS_TARGETS.tripCreate, 'tokyo_example');
              onCreateTokyoExample?.();
            }}
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
          {trips.map((trip) => {
            const openTrip = () => {
              trackPickerButton(ANALYTICS_TARGETS.tripSelect, 'saved_trip');
              onOpen(trip.id);
            };
            return (
              <li key={trip.id} className="trip-map-picker-item">
                <TripListCard
                  preview={<TripStaticMapPreview trip={trip} />}
                  title={trip.title}
                  meta={L('trip:tripPickerPopup.text.daysLocations', {
                    dayCount: trip.days.length,
                    placeCount: trip.days.reduce(
                      (count, day) => count + day.places.length,
                      0,
                    ),
                  })}
                  status={<TripUpdatedAt value={trip.updatedAt} />}
                  disabled={busy}
                  onActivate={openTrip}
                  primaryAction={
                    <Button
                      className="trip-map-picker-item-open"
                      data-analytics-id={ANALYTICS_TARGETS.tripSelect}
                      data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
                      size="sm"
                      disabled={busy}
                      onClick={openTrip}
                    >
                      {L('trip:tripPickerPopup.action.open')}
                    </Button>
                  }
                  secondaryActions={
                    mode === 'edit' && (
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
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
