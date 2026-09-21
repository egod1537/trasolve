import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';

const LONG_PRESS_DURATION_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 8;
const POPOVER_GAP = 8;
const VIEWPORT_GAP = 8;

const DAY_COLOR_OPTIONS = [
  { value: '#2563eb', label: '파랑' },
  { value: '#0e7490', label: '청록' },
  { value: '#16a34a', label: '초록' },
  { value: '#ca8a04', label: '노랑' },
  { value: '#ea580c', label: '주황' },
  { value: '#dc2626', label: '빨강' },
  { value: '#db2777', label: '분홍' },
  { value: '#7c3aed', label: '보라' },
  { value: '#475569', label: '회청' },
  { value: '#0f172a', label: '남회' },
] as const;

type Props = {
  dayId: string;
  dayTitle: string;
  color: string;
  visible: boolean;
  onToggleVisibility: (dayId: string) => void;
  onChangeColor: (dayId: string, color: string) => void;
};

type PressOrigin = { x: number; y: number };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function DayColorControl({
  dayId,
  dayTitle,
  color,
  visible,
  onToggleVisibility,
  onChangeColor,
}: Props) {
  const pickerId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOriginRef = useRef<PressOrigin | null>(null);
  const longPressTriggeredRef = useRef(false);
  const focusPickerRef = useRef(false);
  const pickerOpenRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStyle, setPickerStyle] = useState<CSSProperties>({
    visibility: 'hidden',
  });

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressOriginRef.current = null;
  }, []);
  const openPicker = useCallback((focusPicker: boolean) => {
    if (pickerOpenRef.current) {
      return;
    }
    pickerOpenRef.current = true;
    focusPickerRef.current = focusPicker;
    setPickerStyle({ visibility: 'hidden' });
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback((restoreFocus = false) => {
    pickerOpenRef.current = false;
    setPickerOpen(false);
    if (restoreFocus) {
      buttonRef.current?.focus();
    }
  }, []);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  useLayoutEffect(() => {
    if (!pickerOpen) {
      return;
    }
    const button = buttonRef.current;
    const picker = pickerRef.current;
    if (!button || !picker) {
      return;
    }

    let positionFrame = 0;
    const updatePosition = () => {
      positionFrame = 0;
      const anchorRect = button.getBoundingClientRect();
      const pickerRect = picker.getBoundingClientRect();
      const anchorOutsideViewport =
        anchorRect.bottom <= 0 ||
        anchorRect.top >= window.innerHeight ||
        anchorRect.right <= 0 ||
        anchorRect.left >= window.innerWidth;
      if (anchorOutsideViewport) {
        closePicker();
        return;
      }

      const maximumLeft = Math.max(
        VIEWPORT_GAP,
        window.innerWidth - pickerRect.width - VIEWPORT_GAP,
      );
      const left = clamp(
        anchorRect.left + anchorRect.width / 2 - pickerRect.width / 2,
        VIEWPORT_GAP,
        maximumLeft,
      );
      const belowTop = anchorRect.bottom + POPOVER_GAP;
      const aboveTop = anchorRect.top - POPOVER_GAP - pickerRect.height;
      const top =
        belowTop + pickerRect.height <= window.innerHeight - VIEWPORT_GAP
          ? belowTop
          : Math.max(VIEWPORT_GAP, aboveTop);
      setPickerStyle({ visibility: 'visible', left, top });
    };
    const schedulePositionUpdate = () => {
      cancelAnimationFrame(positionFrame);
      positionFrame = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(schedulePositionUpdate);
    resizeObserver.observe(button);
    resizeObserver.observe(picker);
    document.addEventListener('scroll', schedulePositionUpdate, true);
    window.addEventListener('resize', schedulePositionUpdate);
    if (focusPickerRef.current) {
      focusPickerRef.current = false;
      const selected = picker.querySelector<HTMLButtonElement>(
        '[aria-pressed="true"]',
      );
      (selected ?? picker.querySelector<HTMLButtonElement>('button'))?.focus();
    }
    return () => {
      cancelAnimationFrame(positionFrame);
      resizeObserver.disconnect();
      document.removeEventListener('scroll', schedulePositionUpdate, true);
      window.removeEventListener('resize', schedulePositionUpdate);
    };
  }, [closePicker, pickerOpen]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (
        buttonRef.current?.contains(event.target) ||
        pickerRef.current?.contains(event.target)
      ) {
        return;
      }
      closePicker();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      closePicker(true);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closePicker, pickerOpen]);

  const startLongPress = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
    pressOriginRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      openPicker(false);
    }, LONG_PRESS_DURATION_MS);
  };
  const trackLongPress = (event: PointerEvent<HTMLButtonElement>) => {
    const origin = pressOriginRef.current;
    if (!origin) {
      return;
    }
    if (
      Math.hypot(event.clientX - origin.x, event.clientY - origin.y) >
      LONG_PRESS_MOVE_TOLERANCE
    ) {
      clearLongPressTimer();
    }
  };

  const picker = pickerOpen ? (
    <div
      ref={pickerRef}
      id={pickerId}
      className="trip-day-color-picker"
      role="dialog"
      aria-label={`${dayTitle} 색상 변경`}
      style={pickerStyle}
    >
      <span className="trip-day-color-picker-title">Day 색상</span>
      <div className="trip-day-color-palette">
        {DAY_COLOR_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-label={`${option.label} ${option.value}`}
            aria-pressed={color.toLowerCase() === option.value}
            style={{ '--palette-color': option.value } as CSSProperties}
            onClick={() => {
              onChangeColor(dayId, option.value);
              closePicker(true);
            }}
          />
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="trip-day-color-control"
        aria-label={`${dayTitle} ${visible ? '표시 중' : '숨김 상태'}. 클릭: 표시/숨김 · 길게 누르기: 색상 변경`}
        aria-pressed={visible}
        aria-haspopup="dialog"
        aria-keyshortcuts="Alt+ArrowDown"
        aria-expanded={pickerOpen}
        aria-controls={pickerOpen ? pickerId : undefined}
        title="클릭: 표시/숨김 · 길게 누르기: 색상 변경"
        onClick={(event) => {
          if (longPressTriggeredRef.current) {
            event.preventDefault();
            longPressTriggeredRef.current = false;
            return;
          }
          closePicker();
          onToggleVisibility(dayId);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          longPressTriggeredRef.current = true;
          openPicker(false);
        }}
        onKeyDown={(event) => {
          if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault();
            openPicker(true);
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            longPressTriggeredRef.current = false;
          }
        }}
        onPointerDown={startLongPress}
        onPointerMove={trackLongPress}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={() => {
          clearLongPressTimer();
          longPressTriggeredRef.current = false;
        }}
        onPointerLeave={clearLongPressTimer}
      >
        <span className="trip-day-color-swatch" aria-hidden="true" />
      </button>
      {picker ? createPortal(picker, document.body) : null}
    </>
  );
}
