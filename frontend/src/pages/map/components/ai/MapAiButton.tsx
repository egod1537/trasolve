import { forwardRef, type MouseEventHandler } from 'react';

type Props = {
  open: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
};

export const MapAiButton = forwardRef<HTMLButtonElement, Props>(
  function MapAiButton({ open, onClick }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={`trip-map-ai-button${open ? ' is-panel-open' : ''}`}
        aria-label="Open AI assistant"
        aria-controls="trip-map-ai-panel"
        aria-expanded={open}
        aria-hidden={open}
        tabIndex={open ? -1 : undefined}
        onClick={onClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5c.45 3.52 2.48 5.55 6 6-3.52.45-5.55 2.48-6 6-.45-3.52-2.48-5.55-6-6 3.52-.45 5.55-2.48 6-6Z" />
          <path d="M18.5 14.5c.2 1.56 1.1 2.46 2.5 2.66-1.4.2-2.3 1.1-2.5 2.66-.2-1.56-1.1-2.46-2.5-2.66 1.4-.2 2.3-1.1 2.5-2.66Z" />
          <path d="M5.5 3c.15 1.17.83 1.85 2 2-.17 1.17-.83 1.85-2 2-.15-1.17-.83-1.83-2-2 1.17-.15 1.85-.83 2-2Z" />
        </svg>
      </button>
    );
  },
);
