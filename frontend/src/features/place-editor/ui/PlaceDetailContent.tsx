import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type PlaceStyle,
  type TripDay,
  type TripPlace,
} from '@trasolve/shared';
import { resolvePlaceStyle } from '@/entities/place';
import { usePlaceDetails } from '@/features/place-editor/model/usePlaceDetails';
import { PlaceStyleIcon } from '@/features/place-editor/ui/PlaceStyleIcon';
import { PlaceTimeTimeline } from '@/features/place-editor/ui/PlaceTimeTimeline';
import { InlineRename } from '@/shared/ui/InlineRename';
import { PlaceStyleControl } from '@/features/place-editor/ui/PlaceStyleControl';
import { PlaceDeleteConfirmCard } from '@/features/place-editor/ui/PlaceDeleteConfirmCard';
import { PlaceDurationControl } from '@/features/place-editor/ui/PlaceDurationControl';
import { MapPopupCardShell } from '@/shared/ui/map/MapPopupCardShell';
import { PlaceOpeningHours } from '@/features/place-editor/ui/PlaceOpeningHours';
import { PlaceOpeningHoursDetails } from '@/features/place-editor/ui/PlaceOpeningHoursDetails';
import { SideDetailCard } from '@/shared/ui/map/SideDetailCard';
import { useL } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';

type PlaceDetailPlace = Omit<TripPlace, 'location'>;
type PlaceDetailDay = Pick<TripDay, 'id' | 'title' | 'color'>;

type Props = {
  day: PlaceDetailDay;
  place: PlaceDetailPlace;
  busy: boolean;
  mutationError: string | null;
  readOnly?: boolean;
  groupClassName: string;
  groupStyle?: CSSProperties;
  layerDetail?: boolean;
  cardRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateVisitTimeRange?: (
    placeId: string,
    time: string,
    visitDurationMinutes: number,
  ) => Promise<boolean>;
  onUpdatePreferredDuration?: (
    placeId: string,
    preferredDurationMinutes: number,
  ) => Promise<boolean>;
  onUpdateMemo?: (placeId: string, memo: string) => Promise<boolean>;
  onRename?: (placeId: string, name: string) => Promise<boolean> | void;
  onUpdateStyle?: (placeId: string, style: PlaceStyle) => void;
  onRemove?: (placeId: string) => Promise<boolean>;
};

export function PlaceDetailContent({
  day,
  place,
  busy,
  mutationError,
  readOnly = true,
  groupClassName,
  groupStyle,
  layerDetail = false,
  cardRef,
  onClose,
  onUpdateVisitTimeRange,
  onUpdatePreferredDuration,
  onUpdateMemo,
  onRename,
  onUpdateStyle,
  onRemove,
}: Props) {
  const L = useL();
  useScreenView(ANALYTICS_SCREENS.placeDetail);
  const details = usePlaceDetails(place.placeId);
  const [timeSubmitting, setTimeSubmitting] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleSubmitting, setTitleSubmitting] = useState(false);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');
  const [memoSubmitting, setMemoSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [openingHoursDetailOpen, setOpeningHoursDetailOpen] = useState(false);
  const deleteConfirmId = useId();
  const openingHoursCardId = useId();
  const cardGroupRef = useRef<HTMLDivElement>(null);
  const internalMainCardRef = useRef<HTMLElement>(null);
  const mainCardRef = cardRef ?? internalMainCardRef;
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled =
    (busy && !timeSubmitting) || titleSubmitting || memoSubmitting || removing;
  const canRename = !readOnly && onRename !== undefined;
  const canEditTime = !readOnly && onUpdateVisitTimeRange !== undefined;
  const canEditDuration = !readOnly && onUpdatePreferredDuration !== undefined;
  const canEditMemo = !readOnly && onUpdateMemo !== undefined;
  const canEditStyle = !readOnly && onUpdateStyle !== undefined;
  const canRemove = !readOnly && onRemove !== undefined;
  const googlePlace = details.status === 'loaded' ? details.place : null;
  const placeStyle = resolvePlaceStyle(place.placeStyle, day.color);
  const openingHours = googlePlace?.openingHours ?? place.openingHours;
  const openingHoursLoadState = !place.placeId
    ? 'ready'
    : details.status === 'error'
      ? 'error'
      : details.status === 'loaded'
        ? 'ready'
        : 'loading';

  useLayoutEffect(() => {
    if (!memoEditing) {
      return;
    }
    const textarea = memoTextareaRef.current;
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [memoEditing]);

  const saveTimeRange = async (time: string, visitDurationMinutes: number) => {
    if (disabled || timeSubmitting || !canEditTime) {
      return false;
    }
    if (
      place.time === time &&
      place.visitDurationMinutes === visitDurationMinutes
    ) {
      return true;
    }
    setTimeSubmitting(true);
    try {
      return await onUpdateVisitTimeRange(place.id, time, visitDurationMinutes);
    } finally {
      setTimeSubmitting(false);
    }
  };

  const startTitleEditing = () => {
    if (disabled || !canRename) {
      return;
    }
    setDeleteConfirmOpen(false);
    setTitleEditing(true);
  };

  const saveTitle = async (draft: string) => {
    const nextName = draft.trim();
    if (!canRename || !nextName || nextName === place.name) {
      setTitleEditing(false);
      return;
    }

    setTitleSubmitting(true);
    try {
      await onRename(place.id, nextName);
    } finally {
      setTitleSubmitting(false);
      setTitleEditing(false);
    }
  };

  const startMemoEditing = () => {
    if (disabled || !canEditMemo) {
      return;
    }
    setDeleteConfirmOpen(false);
    setMemoDraft(place.memo ?? '');
    setMemoEditing(true);
  };

  const cancelMemoEditing = () => {
    setMemoDraft(place.memo ?? '');
    setMemoEditing(false);
  };

  const saveMemo = async () => {
    if (disabled || !canEditMemo) {
      return;
    }
    const nextMemo = memoDraft.trim();
    if (nextMemo === (place.memo ?? '')) {
      setMemoEditing(false);
      return;
    }
    setMemoSubmitting(true);
    try {
      if (await onUpdateMemo(place.id, nextMemo)) {
        setMemoEditing(false);
      } else {
        cancelMemoEditing();
      }
    } finally {
      setMemoSubmitting(false);
    }
  };

  const closeDeleteConfirmation = (restoreFocus: boolean) => {
    if (removing) {
      return;
    }
    setDeleteConfirmOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => deleteTriggerRef.current?.focus());
    }
  };

  const confirmRemove = async () => {
    if (disabled || !canRemove) {
      return;
    }
    setRemoving(true);
    try {
      if (await onRemove(place.id)) {
        trackEvent({
          eventType: 'remove_place',
          screen: ANALYTICS_SCREENS.placeDetail,
          target: ANALYTICS_TARGETS.removePlace,
          metadata: {
            source: layerDetail ? 'layer_detail' : 'map_detail',
            success: true,
          },
        });
        setDeleteConfirmOpen(false);
        onClose();
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      ref={cardGroupRef}
      className={groupClassName}
      style={groupStyle}
      data-layer-detail-card={layerDetail || undefined}
    >
      <MapPopupCardShell
        cardRef={mainCardRef}
        className="trip-place-card"
        title={
          <span
            className="trip-place-card-title"
            style={{ color: placeStyle.color }}
          >
            {canEditStyle ? (
              <PlaceStyleControl
                placeId={place.id}
                placeName={place.name}
                style={placeStyle}
                visible
                busy={disabled}
                className="trip-place-card-style-control"
                triggerLabel={L(
                  'place:placeDetailContent.text.changeVenueStyle',
                )}
                onChangeStyle={onUpdateStyle}
              />
            ) : (
              <span className="trip-place-card-static-style-icon">
                <PlaceStyleIcon type={placeStyle.type} />
              </span>
            )}
            {titleEditing ? (
              <InlineRename
                value={place.name}
                ariaLabel={L(
                  'place:placeDetailContent.ariaLabel.editPlaceName',
                  { name: place.name },
                )}
                className="trip-place-card-title-input"
                disabled={titleSubmitting}
                onCommit={(draft) => void saveTitle(draft)}
                onCancel={() => setTitleEditing(false)}
              />
            ) : canRename ? (
              <span
                className="trip-place-card-title-name"
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                title={L(
                  'place:placeDetailContent.tooltip.doubleClickEditPlaceName',
                )}
                onDoubleClick={startTitleEditing}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'F2') {
                    event.preventDefault();
                    event.stopPropagation();
                    startTitleEditing();
                  }
                }}
              >
                {place.name}
              </span>
            ) : (
              <span className="trip-place-card-title-name">{place.name}</span>
            )}
          </span>
        }
        subtitle={<p className="trip-place-card-position">{day.title}</p>}
        closeLabel={L('place:placeDetailContent.text.closeLocationDetailsCard')}
        onClose={onClose}
        headerActions={
          canRemove ? (
            <button
              ref={deleteTriggerRef}
              type="button"
              className="trip-place-header-action trip-place-delete-trigger"
              aria-label={L(
                'place:placeDetailContent.ariaLabel.removeFromCalendar',
              )}
              title={L('place:placeDetailContent.ariaLabel.removeFromCalendar')}
              aria-haspopup="dialog"
              aria-expanded={deleteConfirmOpen}
              aria-controls={deleteConfirmOpen ? deleteConfirmId : undefined}
              disabled={disabled}
              onClick={() => {
                setOpeningHoursDetailOpen(false);
                setDeleteConfirmOpen(true);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
              </svg>
            </button>
          ) : undefined
        }
      >
        {(place.placeId || openingHours) && (
          <PlaceOpeningHours
            hours={openingHours}
            loadState={openingHoursLoadState}
            detailsOpen={openingHoursDetailOpen}
            detailsControlId={openingHoursCardId}
            onToggleDetails={() => {
              setDeleteConfirmOpen(false);
              setOpeningHoursDetailOpen((open) => !open);
            }}
          />
        )}

        <PlaceTimeTimeline
          time={place.time}
          visitDurationMinutes={
            place.preferredDurationMinutes ?? place.visitDurationMinutes
          }
          openingHours={openingHours}
          variant="expanded"
          readOnly={!canEditTime}
          busy={disabled}
          saving={timeSubmitting}
          onChangeTimeRange={canEditTime ? saveTimeRange : undefined}
        />

        <section className="trip-place-duration-section">
          <div className="trip-place-duration-heading">
            <h3>{L('place:placeDetailContent.title.desiredStayTime')}</h3>
            <small>
              {L('place:placeDetailContent.description.setTimeYouWillStayAt')}
            </small>
          </div>
          <PlaceDurationControl
            preferredDurationMinutes={place.preferredDurationMinutes}
            editable={canEditDuration}
            disabled={disabled}
            onChange={
              canEditDuration
                ? (preferredDurationMinutes) =>
                    onUpdatePreferredDuration(
                      place.id,
                      preferredDurationMinutes,
                    )
                : undefined
            }
          />
        </section>

        <div className="trip-place-card-body">
          <section className="trip-place-management-section">
            <h3>{L('place:placeDetailContent.title.memo')}</h3>
            {memoEditing ? (
              <form
                className="trip-place-memo-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveMemo();
                }}
              >
                <textarea
                  ref={memoTextareaRef}
                  value={memoDraft}
                  maxLength={4000}
                  aria-label={L('place:placeDetailContent.ariaLabel.notes', {
                    name: place.name,
                  })}
                  disabled={disabled}
                  onChange={(event) => setMemoDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      cancelMemoEditing();
                      return;
                    }
                    if (
                      event.key === 'Enter' &&
                      (event.ctrlKey || event.metaKey)
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <div className="trip-place-memo-editor-actions">
                  {memoSubmitting && (
                    <span role="status">
                      {L('place:placeDetailContent.text.savingNote')}
                    </span>
                  )}
                  <button type="submit" disabled={disabled}>
                    {L('common:action.save')}
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={cancelMemoEditing}
                  >
                    {L('common:action.cancel')}
                  </button>
                </div>
              </form>
            ) : canEditMemo ? (
              <p
                className={
                  place.memo ? 'trip-place-memo' : 'trip-place-memo is-empty'
                }
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled}
                aria-label={L('place:placeDetailContent.ariaLabel.memo', {
                  name: place.name,
                  value: place.memo
                    ? L('place:placeDetailContent.ariaLabel.edit')
                    : L('common:action.add'),
                })}
                title={L('place:placeDetailContent.tooltip.doubleClickEdit')}
                onDoubleClick={startMemoEditing}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    startMemoEditing();
                  }
                }}
              >
                {place.memo ||
                  L(
                    'place:placeDetailContent.description.doubleClickEnterNote',
                  )}
              </p>
            ) : (
              <p
                className={
                  place.memo ? 'trip-place-memo' : 'trip-place-memo is-empty'
                }
              >
                {place.memo ||
                  L('place:placeDetailContent.description.noNotes')}
              </p>
            )}
          </section>

          {(place.address ||
            googlePlace?.address ||
            googlePlace?.googleMapsUrl) && (
            <section className="trip-place-management-section">
              <h3>{L('place:googlePlaceCard.tooltip.locationInformation')}</h3>
              {(place.address || googlePlace?.address) && (
                <p className="trip-place-address">
                  {googlePlace?.address ?? place.address}
                </p>
              )}
              {googlePlace?.googleMapsUrl && (
                <a
                  className="trip-place-google-maps-link"
                  href={googlePlace.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {L('place:googlePlaceCard.text.viewGoogleMaps')}
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 5h5v5M19 5l-8 8M18 13v6H5V6h6" />
                  </svg>
                </a>
              )}
            </section>
          )}

          {mutationError && (
            <p className="trip-place-mutation-error" role="alert">
              {mutationError}
            </p>
          )}
        </div>
      </MapPopupCardShell>

      {openingHoursDetailOpen && openingHours && (
        <SideDetailCard
          id={openingHoursCardId}
          title={L('place:placeDetailContent.tooltip.businessHours')}
          groupRef={cardGroupRef}
          mainCardRef={mainCardRef}
          closeLabel={L(
            'place:placeDetailContent.text.closeBusinessHoursDetails',
          )}
          onClose={() => setOpeningHoursDetailOpen(false)}
        >
          <PlaceOpeningHoursDetails hours={openingHours} />
        </SideDetailCard>
      )}
      {deleteConfirmOpen && (
        <PlaceDeleteConfirmCard
          id={deleteConfirmId}
          placeName={place.name}
          anchorRef={mainCardRef}
          busy={removing}
          confirmDisabled={disabled}
          onCancel={closeDeleteConfirmation}
          onConfirm={() => void confirmRemove()}
        />
      )}
    </div>
  );
}
