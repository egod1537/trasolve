import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useId, useState } from 'react';
import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type AnalyticsEventMetadata,
  type AnalyticsTarget,
  type Trip,
} from '@trasolve/shared';
import { MapUserControls } from '@/features/auth';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { EmptyState } from '@/shared/ui/EmptyState';
import { IconButton } from '@/shared/ui/IconButton';
import {
  BookIcon,
  CloseIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from '@/shared/ui/icons';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { useL } from '@/shared/i18n';
import type { MapWorkspaceMode } from '@/features/map-workspace/model/mapWorkspaceMode';
import { trackEvent, useScreenView } from '@/shared/analytics';
import { TripMapPreview } from '@/features/map-workspace/components/TripMapPreview';
import { TripPreviewPool } from './TripPreviewPool';
import { TripDeleteConfirmation } from '@/features/map-workspace/components/TripDeleteConfirmation';
import { useTutorial } from '@/features/onboarding';

type CommonProps = {
  mode: MapWorkspaceMode;
  debugMode: boolean;
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
  debugMode,
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
  const tutorial = useTutorial();
  const titleId = useId();
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
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

  return (
    <Dialog
      className="trip-map-picker-popup"
      backdropClassName="trip-map-picker-backdrop"
      labelledBy={titleId}
      busy={busy}
      closeOnBackdrop={false}
      closeOnEscape={canClose && deletingTrip === null && !tutorial?.active}
      onClose={onClose}
      accessory={
        <MapUserControls onOpenTripPicker={onRefresh} showTokens={false} />
      }
    >
      <header className="trip-map-picker-header">
        <div className="trip-map-picker-title">
          <h2 id={titleId}>{L('trip:tripPickerPopup.title.myTrip')}</h2>
          <span className="trip-map-picker-loading" role="status">
            {busy && (
              <>
                <LoadingSpinner size="md" />
                <span className="sr-only">
                  {L('trip:tripPickerPopup.description.itSBringingYouTravel')}
                </span>
              </>
            )}
          </span>
        </div>
        <div className="trip-map-picker-header-actions">
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
            data-tutorial="create-trip"
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
          {debugMode && (
            <>
              <Button
                className="trip-map-picker-action"
                data-analytics-id={ANALYTICS_TARGETS.tripCreate}
                data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
                aria-label={L(
                  'trip:tripPickerPopup.text.createExampleTripSeoul',
                )}
                disabled={busy}
                startIcon={<BookIcon />}
                onClick={() => {
                  trackPickerButton(
                    ANALYTICS_TARGETS.tripCreate,
                    'seoul_example',
                  );
                  onCreateSeoulExample?.();
                }}
              >
                <span>
                  {L('trip:tripPickerPopup.text.createExampleTripSeoul')}
                </span>
              </Button>
              <Button
                className="trip-map-picker-action"
                data-analytics-id={ANALYTICS_TARGETS.tripCreate}
                data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
                aria-label={L(
                  'trip:tripPickerPopup.text.createExampleTripTokyo',
                )}
                disabled={busy}
                startIcon={<BookIcon />}
                onClick={() => {
                  trackPickerButton(
                    ANALYTICS_TARGETS.tripCreate,
                    'tokyo_example',
                  );
                  onCreateTokyoExample?.();
                }}
              >
                <span>
                  {L('trip:tripPickerPopup.text.createExampleTripTokyo')}
                </span>
              </Button>
            </>
          )}
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
        <TripPreviewPool>
          <ScrollArea className="trip-map-picker-list-scroll" contentAsChild>
            <ul className="trip-map-picker-list">
              {trips.map((trip) => (
                <li key={trip.id} className="trip-map-picker-item">
                  <TripMapPreview
                    trip={trip}
                    disabled={busy}
                    onOpen={() => {
                      trackPickerButton(
                        ANALYTICS_TARGETS.tripSelect,
                        'saved_trip',
                      );
                      onOpen(trip.id);
                    }}
                  />
                  <div className="trip-map-picker-item-body">
                    <div className="trip-map-picker-item-heading">
                      <button
                        type="button"
                        className="trip-map-picker-item-select"
                        data-analytics-id={ANALYTICS_TARGETS.tripSelect}
                        data-analytics-screen={ANALYTICS_SCREENS.tripPicker}
                        disabled={busy}
                        onClick={() => {
                          trackPickerButton(
                            ANALYTICS_TARGETS.tripSelect,
                            'saved_trip',
                          );
                          onOpen(trip.id);
                        }}
                      >
                        <strong
                          className="trip-map-picker-item-title"
                          title={trip.title}
                        >
                          {trip.title}
                        </strong>
                      </button>
                      <div className="trip-map-picker-item-actions">
                        {mode === 'edit' && (
                          <IconButton
                            className="trip-map-picker-item-delete"
                            aria-label={L(
                              'trip:tripPickerPopup.ariaLabel.delete',
                              {
                                title: trip.title,
                              },
                            )}
                            title={L('common:action.delete')}
                            variant="ghost"
                            size="sm"
                            icon={<TrashIcon />}
                            disabled={busy}
                            onClick={() => setDeletingTrip(trip)}
                          />
                        )}
                      </div>
                    </div>
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
                </li>
              ))}
            </ul>
          </ScrollArea>
        </TripPreviewPool>
      )}
      {deletingTrip && mode === 'edit' && (
        <TripDeleteConfirmation
          trip={deletingTrip}
          onCancel={() => setDeletingTrip(null)}
          onConfirm={() => {
            const id = deletingTrip.id;
            setDeletingTrip(null);
            onDelete(id);
          }}
        />
      )}
    </Dialog>
  );
}
