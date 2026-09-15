import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { TRIP_PLACE_MAX_DURATION_MINUTES } from '@trasolve/shared';

const MIN_PLACE_DURATION_MINUTES = 30;
const PLACE_DURATION_STEP_MINUTES = 30;
const PLACE_DURATION_OPTIONS = [30, 60, 90, 120, 180] as const;
const POPUP_GAP = 10;
const VIEWPORT_GAP = 8;

type PopupPlacement = 'right' | 'left' | 'viewport';

type Props = {
  preferredDurationMinutes: number | undefined;
  editable: boolean;
  disabled: boolean;
  onChange?: (preferredDurationMinutes: number) => Promise<boolean>;
};

function formatDurationOption(durationMinutes: number): string {
  return `${durationMinutes}분`;
}

function normalizeDuration(durationMinutes: number): number {
  return Math.min(
    TRIP_PLACE_MAX_DURATION_MINUTES,
    Math.max(
      MIN_PLACE_DURATION_MINUTES,
      Math.round(durationMinutes / PLACE_DURATION_STEP_MINUTES) *
        PLACE_DURATION_STEP_MINUTES,
    ),
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function PlaceDurationControl({
  preferredDurationMinutes,
  editable,
  disabled,
  onChange,
}: Props) {
  const popupId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [customInputOpen, setCustomInputOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [popupPlacement, setPopupPlacement] = useState<PopupPlacement>('right');
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({
    visibility: 'hidden',
  });
  const interactive = editable && onChange !== undefined;
  const controlDisabled = disabled || submitting;
  const hasDuration = preferredDurationMinutes !== undefined;

  const closePopup = useCallback((restoreFocus = false) => {
    setPopupOpen(false);
    setCustomInputOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!popupOpen) {
      return;
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !popupRef.current?.contains(event.target)
      ) {
        closePopup();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closePopup(true);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closePopup, popupOpen]);

  useLayoutEffect(() => {
    if (!popupOpen) {
      return;
    }
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup) {
      return;
    }

    let positionFrame = 0;
    const updatePosition = () => {
      positionFrame = 0;
      const triggerRect = trigger.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const triggerOutsideViewport =
        triggerRect.bottom <= 0 ||
        triggerRect.top >= window.innerHeight ||
        triggerRect.right <= 0 ||
        triggerRect.left >= window.innerWidth;
      if (triggerOutsideViewport) {
        closePopup();
        return;
      }

      const preferredRight = triggerRect.right + POPUP_GAP;
      const preferredLeft = triggerRect.left - POPUP_GAP - popupRect.width;
      const fitsRight =
        preferredRight + popupRect.width <= window.innerWidth - VIEWPORT_GAP;
      const fitsLeft = preferredLeft >= VIEWPORT_GAP;
      const placement: PopupPlacement = fitsRight
        ? 'right'
        : fitsLeft
          ? 'left'
          : 'viewport';
      const maximumLeft = Math.max(
        VIEWPORT_GAP,
        window.innerWidth - popupRect.width - VIEWPORT_GAP,
      );
      const maximumTop = Math.max(
        VIEWPORT_GAP,
        window.innerHeight - popupRect.height - VIEWPORT_GAP,
      );
      setPopupPlacement(placement);
      setPopupStyle({
        visibility: 'visible',
        left:
          placement === 'right'
            ? preferredRight
            : placement === 'left'
              ? preferredLeft
              : clamp(
                  triggerRect.right - popupRect.width,
                  VIEWPORT_GAP,
                  maximumLeft,
                ),
        top: clamp(
          triggerRect.top + (triggerRect.height - popupRect.height) / 2,
          VIEWPORT_GAP,
          maximumTop,
        ),
      });
    };
    const schedulePositionUpdate = () => {
      cancelAnimationFrame(positionFrame);
      positionFrame = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(schedulePositionUpdate);
    resizeObserver.observe(trigger);
    resizeObserver.observe(popup);
    document.addEventListener('scroll', schedulePositionUpdate, true);
    window.addEventListener('resize', schedulePositionUpdate);

    if (customInputOpen) {
      customInputRef.current?.focus();
      customInputRef.current?.select();
    } else {
      const selectedOption = popup.querySelector<HTMLButtonElement>(
        '[aria-pressed="true"]',
      );
      (
        selectedOption ?? popup.querySelector<HTMLButtonElement>('button')
      )?.focus();
    }

    return () => {
      cancelAnimationFrame(positionFrame);
      resizeObserver.disconnect();
      document.removeEventListener('scroll', schedulePositionUpdate, true);
      window.removeEventListener('resize', schedulePositionUpdate);
    };
  }, [closePopup, customInputOpen, popupOpen]);

  const updateDuration = async (nextDuration: number) => {
    closePopup(true);
    if (
      controlDisabled ||
      !interactive ||
      nextDuration === preferredDurationMinutes
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await onChange(nextDuration);
    } finally {
      setSubmitting(false);
    }
  };

  const openCustomInput = () => {
    setCustomDraft(
      preferredDurationMinutes === undefined
        ? '60'
        : preferredDurationMinutes.toString(),
    );
    setCustomInputOpen(true);
  };

  const submitCustomDuration = () => {
    const parsedDuration = Number(customDraft);
    if (!customDraft.trim() || !Number.isFinite(parsedDuration)) {
      return;
    }
    void updateDuration(normalizeDuration(parsedDuration));
  };

  const content = (
    <>
      <span className="trip-place-duration-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </span>
      <span className="trip-place-duration-value">
        {hasDuration
          ? formatDurationOption(preferredDurationMinutes)
          : '시간을 선택해 주세요'}
        {interactive && (
          <svg
            className={popupOpen ? 'is-open' : undefined}
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        )}
      </span>
      <span
        className={`trip-place-duration-badge${hasDuration ? ' is-set' : ''}`}
      >
        {hasDuration ? '설정됨' : '설정 안 됨'}
      </span>
    </>
  );

  const popup = popupOpen ? (
    <div
      ref={popupRef}
      id={popupId}
      className="trip-place-duration-popup"
      data-layer-interactive-popover=""
      data-placement={popupPlacement}
      role="dialog"
      aria-label="희망 체류 시간 선택"
      style={popupStyle}
    >
      <div className="trip-place-duration-options">
        {PLACE_DURATION_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={preferredDurationMinutes === option}
            disabled={controlDisabled}
            onClick={() => void updateDuration(option)}
          >
            {formatDurationOption(option)}
          </button>
        ))}
      </div>
      {customInputOpen ? (
        <form
          className="trip-place-duration-custom-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitCustomDuration();
          }}
        >
          <label>
            <span className="sr-only">직접 입력할 체류 시간</span>
            <input
              ref={customInputRef}
              type="number"
              min={MIN_PLACE_DURATION_MINUTES}
              max={TRIP_PLACE_MAX_DURATION_MINUTES}
              step={PLACE_DURATION_STEP_MINUTES}
              value={customDraft}
              disabled={controlDisabled}
              onChange={(event) => setCustomDraft(event.target.value)}
            />
            <span>분</span>
          </label>
          <button type="submit" disabled={controlDisabled}>
            적용
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="trip-place-duration-custom-trigger"
          disabled={controlDisabled}
          onClick={openCustomInput}
        >
          직접 입력
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className="trip-place-duration-selector">
      {interactive ? (
        <button
          ref={triggerRef}
          type="button"
          className="trip-place-duration-trigger"
          aria-label={`희망 체류 시간: ${hasDuration ? formatDurationOption(preferredDurationMinutes) : '설정 안 됨'}`}
          aria-haspopup="dialog"
          aria-expanded={popupOpen}
          aria-controls={popupOpen ? popupId : undefined}
          aria-busy={submitting}
          disabled={controlDisabled}
          onClick={() => {
            if (popupOpen) {
              closePopup();
            } else {
              setPopupStyle({ visibility: 'hidden' });
              setPopupOpen(true);
            }
          }}
        >
          {content}
        </button>
      ) : (
        <div className="trip-place-duration-trigger is-readonly">{content}</div>
      )}
      {popup ? createPortal(popup, document.body) : null}
    </div>
  );
}
