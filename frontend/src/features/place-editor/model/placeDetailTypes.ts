import { type CSSProperties, type RefObject } from 'react';
import {
  type PlaceStyle,
  type TripDay,
  type TripPlace,
} from '@trasolve/shared';

export type PlaceDetailPlace = Omit<TripPlace, 'location'>;

export type PlaceDetailDay = Pick<TripDay, 'id' | 'title' | 'color'>;

export type Props = {
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
