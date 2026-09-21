import type { RefObject } from 'react';
import type { PlaceStyle } from '@trasolve/shared';
import type { TripDay, TripPlace } from '@/entities/trip';
import { PlaceDetailContent } from '@/features/place-editor';
import { useLayerDetailCardPlacement } from '@/features/map-workspace/components/layer-panel/LayerDetailCard';

const PLACE_DETAIL_CARD_WIDTH = 442;

type Props = {
  day: TripDay;
  place: TripPlace;
  busy: boolean;
  mutationError: string | null;
  anchorKey: string;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onUpdateVisitTimeRange: (
    placeId: string,
    time: string,
    visitDurationMinutes: number,
  ) => Promise<boolean>;
  onUpdatePreferredDuration: (
    placeId: string,
    preferredDurationMinutes: number,
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
  onUpdateVisitTimeRange,
  onUpdatePreferredDuration,
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
      onUpdateVisitTimeRange={onUpdateVisitTimeRange}
      onUpdatePreferredDuration={onUpdatePreferredDuration}
      onUpdateMemo={onUpdateMemo}
      onRename={onRename}
      onUpdateStyle={onUpdateStyle}
      onRemove={onRemove}
    />
  );
}
