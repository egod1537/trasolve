import { ScrollArea } from '@/shared/ui/ScrollArea';
import { MapPopupCardShell } from '@/shared/ui/map/MapPopupCardShell';
import { SideDetailCard } from '@/shared/ui/map/SideDetailCard';
import { PlaceTimeTimeline } from './PlaceTimeTimeline';
import { PlaceDeleteConfirmCard } from './PlaceDeleteConfirmCard';
import { PlaceOpeningHours } from './PlaceOpeningHours';
import { PlaceOpeningHoursDetails } from './PlaceOpeningHoursDetails';
import { PlaceDetailTitle, PlaceDetailDeleteButton } from './PlaceDetailHeader';
import { PlaceDetailMemo } from './PlaceDetailMemo';
import { PlaceDetailLocation } from './PlaceDetailLocation';
import { usePlaceDetail } from './usePlaceDetail';
import type { Props } from './placeDetailContentTypes';

export function PlaceDetailContent(props: Props) {
  const {
    day,
    place,
    mutationError,
    groupClassName,
    groupStyle,
    layerDetail = false,
    onClose,
    onUpdateStyle,
  } = props;
  const {
    cardGroupRef,
    mainCardRef,
    deleteTriggerRef,
    memoTextareaRef,
    ...state
  } = usePlaceDetail(props);
  const { L, openingHours, openingHoursLoadState } = state;
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
          <PlaceDetailTitle
            place={place}
            placeStyle={state.placeStyle}
            canEditStyle={state.canEditStyle}
            canRename={state.canRename}
            disabled={state.disabled}
            titleEditing={state.titleEditing}
            titleSubmitting={state.titleSubmitting}
            onUpdateStyle={onUpdateStyle}
            onCommit={(draft) => void state.saveTitle(draft)}
            onCancel={() => state.setTitleEditing(false)}
            onStartEditing={state.startTitleEditing}
          />
        }
        subtitle={<p className="trip-place-card-position">{day.title}</p>}
        closeLabel={L('place:placeDetailContent.text.closeLocationDetailsCard')}
        onClose={onClose}
        headerActions={
          state.canRemove ? (
            <PlaceDetailDeleteButton
              triggerRef={deleteTriggerRef}
              open={state.deleteConfirmOpen}
              confirmId={state.deleteConfirmId}
              disabled={state.disabled}
              onOpen={() => {
                state.setOpeningHoursDetailOpen(false);
                state.setDeleteConfirmOpen(true);
              }}
            />
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
              detailsOpen={state.openingHoursDetailOpen}
              detailsControlId={state.openingHoursCardId}
              onToggleDetails={() => {
                state.setDeleteConfirmOpen(false);
                state.setOpeningHoursDetailOpen((open) => !open);
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
            readOnly={!state.canEditTime}
            busy={state.disabled}
            saving={state.timeSubmitting}
            onChangeTimeRange={
              state.canEditTime ? state.saveTimeRange : undefined
            }
          />
          <div className="trip-place-card-body">
            <PlaceDetailMemo
              place={place}
              canEditMemo={state.canEditMemo}
              disabled={state.disabled}
              memoEditing={state.memoEditing}
              memoDraft={state.memoDraft}
              memoSubmitting={state.memoSubmitting}
              memoTextareaRef={memoTextareaRef}
              onDraftChange={state.setMemoDraft}
              onSave={() => void state.saveMemo()}
              onStartEditing={state.startMemoEditing}
              onCancel={state.cancelMemoEditing}
            />
            <PlaceDetailLocation
              place={place}
              googlePlace={state.googlePlace}
            />
            {mutationError && (
              <p className="trip-place-mutation-error" role="alert">
                {mutationError}
              </p>
            )}
          </div>
        </ScrollArea>
      </MapPopupCardShell>
      {state.openingHoursDetailOpen && openingHours && (
        <SideDetailCard
          id={state.openingHoursCardId}
          title={L('place:placeDetailContent.tooltip.businessHours')}
          groupRef={cardGroupRef}
          mainCardRef={mainCardRef}
          closeLabel={L(
            'place:placeDetailContent.text.closeBusinessHoursDetails',
          )}
          onClose={() => state.setOpeningHoursDetailOpen(false)}
        >
          <PlaceOpeningHoursDetails hours={openingHours} />
        </SideDetailCard>
      )}
      {state.deleteConfirmOpen && (
        <PlaceDeleteConfirmCard
          id={state.deleteConfirmId}
          placeName={place.name}
          anchorRef={mainCardRef}
          busy={state.removing}
          confirmDisabled={state.disabled}
          onCancel={state.closeDeleteConfirmation}
          onConfirm={() => void state.confirmRemove()}
        />
      )}
    </div>
  );
}
