import type { ReactNode } from 'react';

type Props = {
  /** Thumbnail slot; any renderer (SVG, static image, snapshot) fits here. */
  preview: ReactNode;
  title: string;
  meta: ReactNode;
  /** Optional extra line such as the last edit time. */
  status?: ReactNode;
  primaryAction: ReactNode;
  secondaryActions?: ReactNode;
  disabled?: boolean;
  /** Mouse shortcut for the primary action; keyboard users use the button. */
  onActivate: () => void;
};

/** Map-thumbnail-first card used by the trip list. Owns layout only. */
export function TripListCard({
  preview,
  title,
  meta,
  status,
  primaryAction,
  secondaryActions,
  disabled = false,
  onActivate,
}: Props) {
  return (
    <article
      className="trip-list-card"
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        if (disabled || event.defaultPrevented) {
          return;
        }
        onActivate();
      }}
    >
      <div className="trip-list-card-preview">{preview}</div>
      <div className="trip-list-card-body">
        <strong className="trip-list-card-title" title={title}>
          {title}
        </strong>
        <span className="trip-list-card-meta">{meta}</span>
        {status && <span className="trip-list-card-status">{status}</span>}
        <div
          className="trip-list-card-actions"
          onClick={(event) => event.preventDefault()}
        >
          {primaryAction}
          {secondaryActions}
        </div>
      </div>
    </article>
  );
}
