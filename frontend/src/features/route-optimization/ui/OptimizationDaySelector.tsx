import { ScrollArea } from '@/shared/ui/ScrollArea';
import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useOptimizationDayPopover } from './useOptimizationDayPopover';
import type { TripDay } from '@trasolve/shared';
import { useL } from '@/shared/i18n';

type Props = {
  popupContainer: HTMLElement | null;
  anchorRef: RefObject<HTMLElement | null>;
  days: readonly TripDay[];
  day: TripDay;
  disabled: boolean;
  onSelect: (id: string) => void;
};

export function OptimizationDaySelector({
  popupContainer,
  anchorRef,
  days,
  day,
  disabled,
  onSelect,
}: Props) {
  const L = useL();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const visible = open && !disabled && popupContainer !== null;
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useOptimizationDayPopover({
    open: visible,
    anchorRef,
    popoverRef: listRef,
    triggerRef,
    onDismiss: () => setOpen(false),
  });

  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    moveDayFocus(event);
  };

  return (
    <fieldset
      disabled={disabled}
      className="route-settings-day-field"
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !listRef.current?.contains(event.relatedTarget)
        ) {
          setOpen(false);
        }
      }}
    >
      <legend>{L('map:layerPanel.ariaLabel.travelItinerary')}</legend>
      <button
        ref={triggerRef}
        type="button"
        className="route-settings-day-trigger"
        aria-haspopup="listbox"
        aria-expanded={visible}
        aria-controls={visible ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4M17 3v4M3 11h18" />
        </svg>
        <span>
          <strong title={day.title}>{day.title}</strong>
          <span>
            {L('map:bottomContextPanel.text.locations', {
              length: day.places.length,
            })}
          </span>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
      {visible &&
        createPortal(
          <div
            className="route-settings-side-panel route-settings-day-popover"
            ref={listRef}
            style={
              {
                '--route-day-list-height': `${Math.max(44, days.length * 48 - 4)}px`,
              } as CSSProperties
            }
            onKeyDown={navigate}
          >
            <h3>
              {L(
                'routeOptimization:routeOptimizationModal.dayList.ariaLabel.selectDay',
              )}
            </h3>
            <ScrollArea
              type="auto"
              className="route-settings-day-list"
              contentClassName="route-settings-day-list-content"
              viewportProps={{
                id: listId,
                role: 'listbox',
                tabIndex: -1,
                'aria-label': L(
                  'routeOptimization:routeOptimizationModal.dayList.ariaLabel.selectDay',
                ),
              }}
            >
              {days.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={day.id === item.id}
                  tabIndex={day.id === item.id ? 0 : -1}
                  title={item.title}
                  onClick={() => {
                    onSelect(item.id);
                    close();
                  }}
                >
                  <strong>{item.title}</strong>
                  <span>
                    {L('map:bottomContextPanel.text.locations', {
                      length: item.places.length,
                    })}
                  </span>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </button>
              ))}
            </ScrollArea>
          </div>,
          popupContainer,
        )}
    </fieldset>
  );
}

function moveDayFocus(event: KeyboardEvent<HTMLDivElement>): void {
  const options = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
  );
  const index = options.indexOf(document.activeElement as HTMLButtonElement);
  let next: number;
  switch (event.key) {
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = options.length - 1;
      break;
    case 'ArrowDown':
      next = (index + 1) % options.length;
      break;
    case 'ArrowUp':
      next = (index - 1 + options.length) % options.length;
      break;
    default:
      return;
  }
  event.preventDefault();
  options[next]?.focus({ preventScroll: true });
  options[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
