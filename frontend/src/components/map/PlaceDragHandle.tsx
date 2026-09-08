import type { KeyboardEvent, PointerEvent } from 'react';

type Props = {
  placeName: string;
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

export function PlaceDragHandle({
  placeName,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
}: Props) {
  return (
    <button
      type="button"
      className={`trip-place-drag-handle${dragging ? ' is-dragging' : ''}`}
      aria-label={`${placeName} 순서 변경`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      title="드래그하거나 Alt + ↑/↓ 키로 순서 변경"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onKeyDown={onKeyDown}
    >
      <svg viewBox="0 0 16 20" aria-hidden="true">
        <circle cx="5" cy="5" r="1.25" />
        <circle cx="11" cy="5" r="1.25" />
        <circle cx="5" cy="10" r="1.25" />
        <circle cx="11" cy="10" r="1.25" />
        <circle cx="5" cy="15" r="1.25" />
        <circle cx="11" cy="15" r="1.25" />
      </svg>
    </button>
  );
}
