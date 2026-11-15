import { type KeyboardEvent, type PointerEvent } from 'react';
import type { JobBuilderLocation } from '@/features/troute-testbed/job-builder/jobBuilderModel';

export interface DragState {
  locationId: string;
  pointerId: number;
  targetIndex: number;
}

export interface LocationItemDragProps {
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export type DropTargetEdge = 'before' | 'after' | null;

export interface DropTarget {
  locationId: string;
  edge: Exclude<DropTargetEdge, null>;
}

export function getDropTarget(
  locations: readonly JobBuilderLocation[],
  dragState: DragState | null,
): DropTarget | null {
  if (!dragState) {
    return null;
  }
  const remainingLocations = locations.filter(
    (location) => location.id !== dragState.locationId,
  );
  const targetLocation =
    dragState.targetIndex >= remainingLocations.length
      ? remainingLocations.at(-1)
      : remainingLocations[dragState.targetIndex];
  if (!targetLocation) {
    return null;
  }
  return {
    locationId: targetLocation.id,
    edge:
      dragState.targetIndex >= remainingLocations.length ? 'after' : 'before',
  };
}
