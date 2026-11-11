import { useLayoutEffect, type RefObject } from 'react';
import { useEventCallback } from '@/shared/lib/useEventCallback';

type Props = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  popoverRef: RefObject<HTMLElement | null>;
  triggerRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
};

/** Position inside the dialog's focus scope, outside its clipped settings body. */
export function useOptimizationDayPopover({
  open,
  anchorRef,
  popoverRef,
  triggerRef,
  onDismiss,
}: Props): void {
  const dismiss = useEventCallback(onDismiss);
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    if (!open || !anchor || !popover) {
      return;
    }
    const position = () => {
      const card = anchor.getBoundingClientRect();
      const popup = popover.getBoundingClientRect();
      const left = card.left - popup.width - 16;
      // Compact viewports cannot fit two cards; keep the chooser in view.
      popover.style.left = `${Math.max(16, Math.min(left >= 16 ? left : card.left, window.innerWidth - popup.width - 16))}px`;
      popover.style.top = `${Math.max(16, Math.min(card.top, window.innerHeight - popup.height - 16))}px`;
      popover.style.visibility = 'visible';
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !popover.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        dismiss();
      }
    };
    const onScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !popover.contains(event.target)) {
        position();
      }
    };
    position();
    const selected = popover.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(popover);
    window.addEventListener('resize', position);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [anchorRef, dismiss, open, popoverRef, triggerRef]);
}
