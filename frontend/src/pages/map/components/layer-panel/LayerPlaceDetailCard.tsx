import type { RefObject } from 'react';
import type { PlaceStyle } from '@trasolve/shared';
import type { TripDay, TripPlace } from '../../domain/trip';
import { PlaceDetailContent } from '../place-detail/PlaceDetailContent';
import { useLayerDetailCardPlacement } from './LayerDetailCard';

const PLACE_DETAIL_CARD_WIDTH = 442;

type Props = {
  day: TripDay;
  place: TripPlace;
  busy: boolean;
  mutationError: string | null;
  anchorKey: string;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateTimeRange: (
    placeId: string,
    time: string,
    durationMinutes: number,
  ) => Promise<boolean>;
  onUpdateMemo: (placeId: string, memo: string) => Promise<boolean>;
  onRename: (placeId: string, name: string) => Promise<boolean>;
  onUpdateStyle: (placeId: string, style: PlaceStyle) => void;
  onRemove: (placeId: string) => Promise<boolean>;
};

export function LayerPlaceDetailCard({
  day,
  place,
  busy,
  mutationError,
  anchorKey,
  sidebarRef,
  onClose,
  onUpdateTimeRange,
  onUpdateMemo,
  onRename,
  onUpdateStyle,
  onRemove,
}: Props) {
  const style = useLayerDetailCardPlacement({
    anchorKey,
    sidebarRef,
    onClose,
    width: PLACE_DETAIL_CARD_WIDTH,
  });

  return (
    <PlaceDetailContent
      day={day}
      place={place}
      busy={busy}
      mutationError={mutationError}
      readOnly={false}
      groupClassName="map-popup-card-group layer-place-detail-card-group"
      groupStyle={style}
      layerDetail
      onClose={onClose}
      onUpdateTimeRange={onUpdateTimeRange}
      onUpdateMemo={onUpdateMemo}
      onRename={onRename}
      onUpdateStyle={onUpdateStyle}
      onRemove={onRemove}
    />
  );
}
