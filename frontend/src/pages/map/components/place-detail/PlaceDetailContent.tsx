import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type { PlaceStyle, TripDay, TripPlace } from '@trasolve/shared';
import { resolvePlaceStyle } from '../../domain/placeStyle';
import { usePlaceDetails } from '../../hooks/usePlaceDetails';
import { PlaceStyleIcon } from '../PlaceStyleIcon';
import { PlaceTimeTimeline } from '../PlaceTimeTimeline';
import { InlineRename } from '../layer-panel/InlineRename';
import { PlaceStyleControl } from '../layer-panel/PlaceStyleControl';
import { PlaceDeleteConfirmCard } from './PlaceDeleteConfirmCard';
import { MapPopupCardShell } from '../viewport/MapPopupCardShell';
import { PlaceOpeningHours } from '../viewport/PlaceOpeningHours';
import { PlaceOpeningHoursDetails } from '../viewport/PlaceOpeningHoursDetails';
import { SideDetailCard } from '../viewport/SideDetailCard';

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
  onUpdateTimeRange?: (
    placeId: string,
    time: string,
    durationMinutes: number,
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
  onUpdateTimeRange,
  onUpdateMemo,
  onRename,
  onUpdateStyle,
  onRemove,
}: Props) {
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
    busy || titleSubmitting || timeSubmitting || memoSubmitting || removing;
  const canRename = !readOnly && onRename !== undefined;
  const canEditTime = !readOnly && onUpdateTimeRange !== undefined;
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

  const saveTimeRange = async (time: string, durationMinutes: number) => {
    if (disabled || !canEditTime) {
      return false;
    }
    if (place.time === time && place.durationMinutes === durationMinutes) {
      return true;
    }
    setTimeSubmitting(true);
    try {
      return await onUpdateTimeRange(place.id, time, durationMinutes);
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
                triggerLabel="장소 스타일 변경"
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
                ariaLabel={`${place.name} 장소명 수정`}
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
                title="더블클릭하여 장소명 수정"
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
        closeLabel="장소 상세 카드 닫기"
        onClose={onClose}
        headerActions={
          canRemove ? (
            <button
              ref={deleteTriggerRef}
              type="button"
              className="trip-place-header-action trip-place-delete-trigger"
              aria-label="일정에서 삭제"
              title="일정에서 삭제"
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
          durationMinutes={place.durationMinutes}
          openingHours={openingHours}
          variant="expanded"
          readOnly={!canEditTime}
          busy={disabled}
          saving={timeSubmitting}
          onChangeTimeRange={canEditTime ? saveTimeRange : undefined}
        />

        <div className="trip-place-card-body">
          <section className="trip-place-management-section">
            <h3>메모</h3>
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
                  aria-label={`${place.name} 메모`}
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
                    <span role="status">메모를 저장하고 있습니다.</span>
                  )}
                  <button type="submit" disabled={disabled}>
                    저장
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={cancelMemoEditing}
                  >
                    취소
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
                aria-label={`${place.name} 메모 ${place.memo ? '수정' : '추가'}`}
                title="더블클릭하여 수정"
                onDoubleClick={startMemoEditing}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    startMemoEditing();
                  }
                }}
              >
                {place.memo || '메모를 입력하려면 더블클릭하세요'}
              </p>
            ) : (
              <p
                className={
                  place.memo ? 'trip-place-memo' : 'trip-place-memo is-empty'
                }
              >
                {place.memo || '메모 없음'}
              </p>
            )}
          </section>

          {(place.address ||
            googlePlace?.address ||
            googlePlace?.googleMapsUrl) && (
            <section className="trip-place-management-section">
              <h3>장소 정보</h3>
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
                  Google 지도에서 보기
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
          title="영업시간"
          groupRef={cardGroupRef}
          mainCardRef={mainCardRef}
          closeLabel="영업시간 상세 닫기"
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
