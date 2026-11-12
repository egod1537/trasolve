import type { RefObject } from 'react';
import type { PlaceStyle } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { InlineRename } from '@/shared/ui/InlineRename';
import type { PlaceDetailPlace } from '../model/placeDetailTypes';
import { PlaceStyleControl } from './PlaceStyleControl';
import { PlaceStyleIcon } from './PlaceStyleIcon';

type Props = {
  place: PlaceDetailPlace;
  placeStyle: PlaceStyle;
  canEditStyle: boolean;
  canRename: boolean;
  disabled: boolean;
  titleEditing: boolean;
  titleSubmitting: boolean;
  onUpdateStyle?: (placeId: string, style: PlaceStyle) => void;
  onCommit: (draft: string) => void;
  onCancel: () => void;
  onStartEditing: () => void;
};
export function PlaceDetailTitle({
  place,
  placeStyle,
  canEditStyle,
  canRename,
  disabled,
  titleEditing,
  titleSubmitting,
  onUpdateStyle,
  onCommit,
  onCancel,
  onStartEditing,
}: Props) {
  const L = useL();
  return (
    <span className="trip-place-card-title" style={{ color: placeStyle.color }}>
      {canEditStyle && onUpdateStyle ? (
        <PlaceStyleControl
          placeId={place.id}
          placeName={place.name}
          style={placeStyle}
          visible
          busy={disabled}
          className="trip-place-card-style-control"
          triggerLabel={L('place:placeDetailContent.text.changeVenueStyle')}
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
          ariaLabel={L('place:placeDetailContent.ariaLabel.editPlaceName', {
            name: place.name,
          })}
          className="trip-place-card-title-input"
          disabled={titleSubmitting}
          onCommit={(draft) => void onCommit(draft)}
          onCancel={() => onCancel()}
        />
      ) : canRename ? (
        <span
          className="trip-place-card-title-name"
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          title={L('place:placeDetailContent.tooltip.doubleClickEditPlaceName')}
          onDoubleClick={onStartEditing}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'F2') {
              event.preventDefault();
              event.stopPropagation();
              onStartEditing();
            }
          }}
        >
          {place.name}
        </span>
      ) : (
        <span className="trip-place-card-title-name">{place.name}</span>
      )}
    </span>
  );
}

export function PlaceDetailDeleteButton({
  triggerRef,
  open,
  confirmId,
  disabled,
  onOpen,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  confirmId: string;
  disabled: boolean;
  onOpen: () => void;
}) {
  const L = useL();
  return (
    <button
      ref={triggerRef}
      type="button"
      className="trip-place-header-action trip-place-delete-trigger"
      aria-label={L('place:placeDetailContent.ariaLabel.removeFromCalendar')}
      title={L('place:placeDetailContent.ariaLabel.removeFromCalendar')}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? confirmId : undefined}
      disabled={disabled}
      onClick={onOpen}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
      </svg>
    </button>
  );
}
