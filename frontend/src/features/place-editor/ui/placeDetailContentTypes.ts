import type { CSSProperties, RefObject } from 'react';
import type { PlaceDetailEditorOptions } from '../model/placeDetailTypes';

export type Props = PlaceDetailEditorOptions & {
  groupClassName: string;
  groupStyle?: CSSProperties;
  layerDetail?: boolean;
  cardRef?: RefObject<HTMLElement | null>;
};
