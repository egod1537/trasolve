import type { RefObject } from 'react';
import type { PlaceStyle, TripDay, TripPlace } from '@trasolve/shared';
import { PlaceDetailContent } from '@/features/place-editor/ui/PlaceDetailContent';

type Props = {
  day: TripDay;
  place: TripPlace;
  busy: boolean;
  mutationError: string | null;
  cardRef?: RefObject<HTMLElement | null>;
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

export function TripPlaceCard({
  day,
  place,
  busy,
  mutationError,
  cardRef,
  onClose,
  onUpdateVisitTimeRange,
  onUpdatePreferredDuration,
  onUpdateMemo,
  onRename,
  onUpdateStyle,
  onRemove,
}: Props) {
  return (
    <PlaceDetailContent
      day={day}
      place={place}
      busy={busy}
      mutationError={mutationError}
      readOnly={false}
      groupClassName="map-popup-card-group"
      cardRef={cardRef}
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
