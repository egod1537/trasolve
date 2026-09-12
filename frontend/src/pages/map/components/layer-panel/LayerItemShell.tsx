import type { CSSProperties, ReactNode } from 'react';
import { LayerTreeNode, type LayerTreeNodeVariant } from './LayerTreeNode';

type Props = {
  type: 'place' | 'polyline';
  itemId: string;
  dayId?: string;
  isLast: boolean;
  selected: boolean;
  detailsOpen?: boolean;
  disabled: boolean;
  dragging?: boolean;
  dropPosition?: 'before' | 'after' | null;
  previewOffset?: number;
  dragHandle?: ReactNode;
  treeNodeVariant?: LayerTreeNodeVariant;
  children: ReactNode;
  statusIndicator?: ReactNode;
  chevron?: ReactNode;
  onOpenDetails?: () => void;
};

type LayerItemStyle = CSSProperties & {
  '--layer-preview-offset': string;
};

export function LayerItemShell({
  type,
  itemId,
  dayId,
  isLast,
  selected,
  detailsOpen = false,
  disabled,
  dragging = false,
  dropPosition = null,
  previewOffset = 0,
  dragHandle,
  treeNodeVariant,
  children,
  statusIndicator,
  chevron,
  onOpenDetails,
}: Props) {
  const style: LayerItemStyle = {
    '--layer-preview-offset': `${previewOffset}px`,
  };

  return (
    <li
      className={`trip-layer-item trip-${type}-item${isLast ? ' is-last' : ''}${selected ? ' is-selected' : ''}${detailsOpen ? ' is-details-open' : ''}${disabled ? ' is-disabled' : ''}${dragging ? ' is-dragging' : ''}${dropPosition ? ` is-drop-${dropPosition}` : ''}`}
      aria-disabled={disabled}
      data-day-id={dayId}
      data-layer-item-key={`${type}:${itemId}`}
      data-place-id={type === 'place' ? itemId : undefined}
      data-polyline-id={type === 'polyline' ? itemId : undefined}
      style={style}
    >
      <div
        className="trip-layer-row"
        onContextMenu={(event) => {
          if (!onOpenDetails || disabled) return;
          const target = event.target;
          if (
            target instanceof Element &&
            target.closest(
              "input, textarea, [contenteditable]:not([contenteditable='false'])",
            )
          ) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onOpenDetails();
        }}
      >
        <LayerTreeNode variant={treeNodeVariant} />
        {dragHandle ?? (
          <span className="trip-layer-leading-slot" aria-hidden="true" />
        )}
        {children}
        {statusIndicator}
        {chevron}
      </div>
    </li>
  );
}
