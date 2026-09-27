import type { KeyboardEvent, PointerEvent } from 'react';
import { useL } from '@/shared/i18n';

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
  const L = useL();
  return (
    <button
      type="button"
      className={`${className}${dragging ? ' is-dragging' : ''}`.trim()}
      disabled={disabled}
      aria-label={L('common:dragHandle.ariaLabel.changeOrder', {
        label: label,
      })}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      title={
        disabled
          ? L('common:dragHandle.tooltip.orderOriginDestinationCannotBeChanged')
          : L('common:dragHandle.tooltip.changeOrderByDraggingUsingAlt')
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
