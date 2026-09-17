import type { MouseEvent } from 'react';

type Props = {
  expanded: boolean;
  controls?: string;
  label: string;
  variant: 'day' | 'item';
  detailControl?: boolean;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function LayerItemChevron({
  expanded,
  controls,
  label,
  variant,
  detailControl = false,
  disabled = false,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className={`trip-layer-chevron is-${variant}`}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={label}
      data-layer-detail-toggle={detailControl ? true : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={expanded ? 'is-expanded' : undefined}
      >
        <path d="m6 4 4 4-4 4" />
      </svg>
    </button>
  );
}
