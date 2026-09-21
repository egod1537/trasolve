export type LayerTreeNodeVariant = 'default' | 'start' | 'destination';

export function LayerTreeNode({
  variant = 'default',
}: {
  variant?: LayerTreeNodeVariant;
}) {
  return (
    <span className={`trip-layer-tree-node is-${variant}`} aria-hidden="true">
      {variant === 'start' && (
        <svg viewBox="0 0 16 16">
          <path d="m5.5 4 6 4-6 4Z" />
        </svg>
      )}
      {variant === 'destination' && (
        <svg viewBox="0 0 16 16">
          <rect className="checker-filled" x="2" y="2" width="6" height="6" />
          <rect className="checker-filled" x="8" y="8" width="6" height="6" />
          <rect
            className="checker-outline"
            x="2"
            y="2"
            width="12"
            height="12"
          />
          <path className="checker-grid" d="M8 2v12M2 8h12" />
        </svg>
      )}
    </span>
  );
}
