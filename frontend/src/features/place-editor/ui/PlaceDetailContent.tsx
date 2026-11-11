import { ScrollArea } from '@/shared/ui/ScrollArea';
import { usePlaceDetail } from '@/features/place-editor/model/usePlaceDetail';

import { PlaceStyleIcon } from '@/features/place-editor/ui/PlaceStyleIcon';
import { PlaceTimeTimeline } from '@/features/place-editor/ui/PlaceTimeTimeline';
import { InlineRename } from '@/shared/ui/InlineRename';
import { PlaceStyleControl } from '@/features/place-editor/ui/PlaceStyleControl';
import { PlaceDeleteConfirmCard } from '@/features/place-editor/ui/PlaceDeleteConfirmCard';
import { MapPopupCardShell } from '@/shared/ui/map/MapPopupCardShell';
import { PlaceOpeningHours } from '@/features/place-editor/ui/PlaceOpeningHours';
import { PlaceOpeningHoursDetails } from '@/features/place-editor/ui/PlaceOpeningHoursDetails';
import { SideDetailCard } from '@/shared/ui/map/SideDetailCard';

import { type Props } from '@/features/place-editor/model/placeDetailTypes';

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
  const {
    L,
    timeSubmitting,
    titleEditing,
    setTitleEditing,
    titleSubmitting,
    memoEditing,
    memoDraft,
    setMemoDraft,
    memoSubmitting,
    removing,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    openingHoursDetailOpen,
    setOpeningHoursDetailOpen,
    deleteConfirmId,
    openingHoursCardId,
    cardGroupRef,
    mainCardRef,
    deleteTriggerRef,
    memoTextareaRef,
    disabled,
    canRename,
    canEditTime,
    canEditMemo,
    canEditStyle,
    canRemove,
    googlePlace,
    placeStyle,
    openingHours,
    openingHoursLoadState,
    saveTimeRange,
    startTitleEditing,
    saveTitle,
    startMemoEditing,
    cancelMemoEditing,
    saveMemo,
    closeDeleteConfirmation,
    confirmRemove,
  } = usePlaceDetail({
    day,
    place,
    busy,
    mutationError,
    readOnly,
    groupClassName,
    groupStyle,
    layerDetail,
    cardRef,
    onClose,
    onUpdateVisitTimeRange,
    onUpdatePreferredDuration,
    onUpdateMemo,
    onRename,
    onUpdateStyle,
    onRemove,
  });
  if (openingHoursLoadState === 'loading') {
    return null;
  }
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
            {canEditStyle && onUpdateStyle ? (
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
        <ScrollArea
          className="trip-place-card-scroll"
          contentClassName="trip-place-card-scroll-content"
          viewportProps={{
            role: 'region',
            tabIndex: 0,
            'aria-label': L(
              'place:googlePlaceCard.tooltip.locationInformation',
            ),
          }}
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
                  onClick={startMemoEditing}
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
                <h3>
                  {L('place:googlePlaceCard.tooltip.locationInformation')}
                </h3>
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
        </ScrollArea>
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
