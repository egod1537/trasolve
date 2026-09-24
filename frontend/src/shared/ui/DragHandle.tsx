import type { KeyboardEvent, PointerEvent } from 'react';

interface DragHandleProps {
  label: string;
  dragging: boolean;
  disabled?: boolean;
  className?: string;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

export function DragHandle({
  label,
  dragging,
  disabled = false,
  className = '',
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDown,
}: DragHandleProps) {
  return (
    <button
      type="button"
      className={`${className}${dragging ? ' is-dragging' : ''}`.trim()}
      disabled={disabled}
      aria-label={`${label} 순서 변경`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      title={
        disabled
          ? '출발지와 도착지는 순서를 변경할 수 없습니다.'
          : '드래그하거나 Alt + ↑/↓ 키로 순서 변경'
      }
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
