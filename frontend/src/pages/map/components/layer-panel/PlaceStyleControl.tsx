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
import type { PlaceStyle, PlaceStyleType } from '@trasolve/shared';
import {
  PLACE_STYLE_OPTIONS,
  PLACE_STYLE_PALETTE,
} from '../../domain/placeStyle';
import { PlaceStyleIcon } from '../PlaceStyleIcon';

const POPOVER_GAP = 8;
const VIEWPORT_GAP = 8;

type PopoverPlacement = 'above' | 'below' | 'overlay';

type PopoverStyle = CSSProperties & {
  '--trip-place-style-anchor-x'?: string;
};

type Props = {
  placeId: string;
  placeName: string;
  style: PlaceStyle;
  visible: boolean;
  busy: boolean;
  className?: string;
  triggerLabel?: string;
  onChangeStyle: (placeId: string, style: PlaceStyle) => void;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function PlaceStyleControl({
  placeId,
  placeName,
  style,
  visible,
  busy,
  className,
  triggerLabel,
  onChangeStyle,
}: Props) {
  const popoverId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusPopoverRef = useRef(false);
  const popoverOpenRef = useRef(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<PopoverStyle>({
    visibility: 'hidden',
  });
  const [popoverPlacement, setPopoverPlacement] =
    useState<PopoverPlacement>('above');

  const openPopover = useCallback((focusPopover: boolean) => {
    if (popoverOpenRef.current) return;
    popoverOpenRef.current = true;
    focusPopoverRef.current = focusPopover;
    setPopoverStyle({ visibility: 'hidden' });
    setPopoverOpen(true);
  }, []);
  const closePopover = useCallback((restoreFocus = false) => {
    popoverOpenRef.current = false;
    setPopoverOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!popoverOpen) return;
    const button = buttonRef.current;
    const popover = popoverRef.current;
    if (!button || !popover) return;

    let positionFrame = 0;
    const updatePosition = () => {
      positionFrame = 0;
      const anchor =
        button.closest<HTMLElement>('.trip-place-card, .trip-place-item') ??
        button;
      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const anchorOutsideViewport =
        anchorRect.bottom <= 0 ||
        anchorRect.top >= window.innerHeight ||
        anchorRect.right <= 0 ||
        anchorRect.left >= window.innerWidth;
      if (anchorOutsideViewport) {
        closePopover();
        return;
      }

      const maximumLeft = Math.max(
        VIEWPORT_GAP,
        window.innerWidth - popoverRect.width - VIEWPORT_GAP,
      );
      const maximumTop = Math.max(
        VIEWPORT_GAP,
        window.innerHeight - popoverRect.height - VIEWPORT_GAP,
      );
      const anchorCenter = anchorRect.left + anchorRect.width / 2;
      const left = clamp(
        anchorCenter - popoverRect.width / 2,
        VIEWPORT_GAP,
        maximumLeft,
      );
      const preferredAboveTop =
        anchorRect.top - POPOVER_GAP - popoverRect.height;
      const preferredBelowTop = anchorRect.bottom + POPOVER_GAP;
      const fitsAbove = preferredAboveTop >= VIEWPORT_GAP;
      const fitsBelow =
        preferredBelowTop + popoverRect.height <=
        window.innerHeight - VIEWPORT_GAP;
      const placement: PopoverPlacement = fitsAbove
        ? 'above'
        : fitsBelow
          ? 'below'
          : 'overlay';
      const top = clamp(
        placement === 'above'
          ? preferredAboveTop
          : placement === 'below'
            ? preferredBelowTop
            : anchorRect.top + 10,
        VIEWPORT_GAP,
        maximumTop,
      );
      setPopoverPlacement(placement);
      setPopoverStyle({
        visibility: 'visible',
        left,
        top,
        '--trip-place-style-anchor-x': `${clamp(
          anchorCenter - left,
          18,
          popoverRect.width - 18,
        )}px`,
      });
    };
    const schedulePositionUpdate = () => {
      cancelAnimationFrame(positionFrame);
      positionFrame = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(schedulePositionUpdate);
    const anchor =
      button.closest<HTMLElement>('.trip-place-card, .trip-place-item') ??
      button;
    resizeObserver.observe(anchor);
    if (anchor !== button) resizeObserver.observe(button);
    resizeObserver.observe(popover);
    document.addEventListener('scroll', schedulePositionUpdate, true);
    window.addEventListener('resize', schedulePositionUpdate);
    if (focusPopoverRef.current) {
      focusPopoverRef.current = false;
      const selectedType = popover.querySelector<HTMLButtonElement>(
        '[data-place-style-type][aria-pressed="true"]',
      );
      (
        selectedType ?? popover.querySelector<HTMLButtonElement>('button')
      )?.focus();
    }
    return () => {
      cancelAnimationFrame(positionFrame);
      resizeObserver.disconnect();
      document.removeEventListener('scroll', schedulePositionUpdate, true);
      window.removeEventListener('resize', schedulePositionUpdate);
    };
  }, [closePopover, popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;
    const closeOnOutsidePointer = (event: globalThis.PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        buttonRef.current?.contains(event.target) ||
        popoverRef.current?.contains(event.target)
      ) {
        return;
      }
      closePopover();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePopover(true);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closePopover, popoverOpen]);

  const updateType = (type: PlaceStyleType) => {
    if (type !== style.type) onChangeStyle(placeId, { ...style, type });
  };

  const popover = popoverOpen ? (
    <div
      ref={popoverRef}
      id={popoverId}
      className="trip-place-style-popover"
      data-placement={popoverPlacement}
      role="dialog"
      aria-label={`${placeName} 아이콘 및 색상 설정`}
      style={popoverStyle}
    >
      <button
        type="button"
        className="trip-place-style-close"
        aria-label="스타일 설정 닫기"
        title="닫기"
        onClick={() => closePopover(true)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
      <div className="trip-place-style-content">
        <fieldset disabled={busy}>
          <legend className="sr-only">장소 타입</legend>
          <div className="trip-place-style-types">
            {PLACE_STYLE_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                className="trip-place-style-cell is-type"
                data-place-style-type={option.type}
                aria-label={option.label}
                aria-pressed={style.type === option.type}
                onClick={() => updateType(option.type)}
              >
                <PlaceStyleIcon type={option.type} />
                <span
                  className="trip-place-style-tooltip"
                  role="tooltip"
                  aria-hidden="true"
                >
                  {option.label}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={busy}>
          <legend className="sr-only">색상</legend>
          <div className="trip-place-style-palette">
            {PLACE_STYLE_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className="trip-place-style-cell is-color"
                aria-label={`${color} 색상`}
                aria-pressed={style.color.toLowerCase() === color}
                style={{ '--palette-color': color } as CSSProperties}
                onClick={() => {
                  if (color !== style.color.toLowerCase()) {
                    onChangeStyle(placeId, { ...style, color });
                  }
                }}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`trip-place-style-control${className ? ` ${className}` : ''}`}
        style={{ '--place-color': style.color } as CSSProperties}
        disabled={busy || !visible}
        aria-label={triggerLabel ?? `${placeName} 아이콘 및 색상 변경`}
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
        aria-controls={popoverOpen ? popoverId : undefined}
        title={triggerLabel ?? '아이콘 및 색상 변경'}
        onClick={(event) => {
          if (popoverOpenRef.current) closePopover();
          else openPopover(event.detail === 0);
        }}
      >
        <span className="trip-place-style-icon-frame" aria-hidden="true">
          <PlaceStyleIcon type={style.type} />
        </span>
      </button>
      {popover ? createPortal(popover, document.body) : null}
    </>
  );
}
