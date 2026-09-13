import { forwardRef, type MouseEventHandler } from 'react';

type Props = {
  open: boolean;
  generating: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
};

export const MapAiButton = forwardRef<HTMLButtonElement, Props>(
  function MapAiButton({ open, generating, onClick }, ref) {
    const actionLabel = open ? 'AI 패널 닫기' : 'AI 패널 열기';
    const label = generating ? `AI 응답 생성 중 · ${actionLabel}` : actionLabel;

    return (
      <button
        ref={ref}
        type="button"
        className={`trip-map-ai-button${open ? ' is-panel-open' : ''}${generating ? ' is-generating' : ''}`}
        aria-label={label}
        title={label}
        aria-controls="trip-map-ai-panel"
        aria-expanded={open}
        aria-busy={generating}
        onClick={onClick}
      >
        <span className="trip-map-ai-button-sweep" aria-hidden="true" />
        <span className="trip-map-ai-button-spinner" aria-hidden="true" />
        <span className="trip-map-ai-button-icon">
          {open ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m14.5 5-7 7 7 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3.5c.45 3.52 2.48 5.55 6 6-3.52.45-5.55 2.48-6 6-.45-3.52-2.48-5.55-6-6 3.52-.45 5.55-2.48 6-6Z" />
              <path d="M18.5 14.5c.2 1.56 1.1 2.46 2.5 2.66-1.4.2-2.3 1.1-2.5 2.66-.2-1.56-1.1-2.46-2.5-2.66 1.4-.2 2.3-1.1 2.5-2.66Z" />
              <path d="M5.5 3c.15 1.17.83 1.85 2 2-.17 1.17-.83 1.85-2 2-.15-1.17-.83-1.83-2-2 1.17-.15 1.85-.83 2-2Z" />
            </svg>
          )}
        </span>
      </button>
    );
  },
);
