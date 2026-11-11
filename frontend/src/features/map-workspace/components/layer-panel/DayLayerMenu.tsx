import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useL } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { MoreIcon, ShuffleIcon, TrashIcon } from '@/shared/ui/icons';

type Props = {
  day: { id: string; title: string; places: readonly unknown[] };
  onShuffle: (dayId: string) => void;
  onRequestDelete: (day: { id: string; title: string }) => void;
};

export function DayLayerMenu({ day, onShuffle, onRequestDelete }: Props) {
  const L = useL();
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const label = L('ai:mapAiPanel.renderThread.ariaLabel.menu', {
    title: day.title,
  });
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) {
      return;
    }
    const position = () => {
      const anchor = trigger.getBoundingClientRect();
      const bounds = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(8, Math.min(anchor.right - bounds.width, window.innerWidth - bounds.width - 8))}px`;
      menu.style.top = `${Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - bounds.height - 8))}px`;
    };
    position();
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const closeOnScroll = (event: Event) => {
      if (event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener('resize', position);
    document.addEventListener('scroll', closeOnScroll, true);
    return () => {
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  return (
    <>
      <IconButton
        ref={triggerRef}
        className="trip-day-menu-trigger"
        icon={<MoreIcon />}
        variant="ghost"
        size="sm"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="trip-day-menu"
            role="menu"
            aria-label={label}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(event.relatedTarget) &&
                !triggerRef.current?.contains(event.relatedTarget)
              ) {
                close();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close(true);
              } else {
                moveMenuFocus(event);
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={day.places.length < 4}
              onClick={() => {
                close(true);
                onShuffle(day.id);
              }}
            >
              <ShuffleIcon />
              {L(
                'testbed:jobBuilderLocationList.ariaLabel.shuffleIntermediatePositions',
              )}
            </button>
            <button
              type="button"
              role="menuitem"
              className="is-destructive"
              onClick={() => {
                close(true);
                onRequestDelete({ id: day.id, title: day.title });
              }}
            >
              <TrashIcon />
              {L('common:action.delete')}
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

function moveMenuFocus(event: KeyboardEvent<HTMLDivElement>): void {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)',
    ),
  );
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
          items.length;
  items[next]?.focus();
}
