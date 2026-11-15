import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '@/shared/ui/IconButton';
import './token-charge-info.css';

export function TokenChargeInfo({
  label,
  message,
  warning,
}: {
  label: string;
  message: string;
  warning?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!open || !trigger || !tooltip) {
      return;
    }
    const position = () => {
      const anchor = trigger.getBoundingClientRect();
      const box = tooltip.getBoundingClientRect();
      const viewport = window.visualViewport;
      const edgeLeft = (viewport?.offsetLeft ?? 0) + 12;
      const edgeTop = (viewport?.offsetTop ?? 0) + 12;
      const edgeRight = edgeLeft + (viewport?.width ?? window.innerWidth) - 24;
      const edgeBottom =
        edgeTop + (viewport?.height ?? window.innerHeight) - 24;
      const left = Math.max(
        edgeLeft,
        Math.min(
          anchor.left + anchor.width / 2 - box.width / 2,
          edgeRight - box.width,
        ),
      );
      const above = anchor.top - box.height - 10;
      const top =
        above >= edgeTop
          ? above
          : Math.min(anchor.bottom + 10, edgeBottom - box.height);
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${Math.max(edgeTop, top)}px`;
      tooltip.style.setProperty(
        '--tooltip-arrow-left',
        `${Math.max(12, Math.min(anchor.left + anchor.width / 2 - left, box.width - 12))}px`,
      );
      tooltip.dataset.placement = above >= edgeTop ? 'top' : 'bottom';
      tooltip.style.visibility = 'visible';
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.contains(event.target)) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(trigger);
    observer.observe(tooltip);
    window.addEventListener('resize', position);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    document.addEventListener('scroll', position, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
      document.removeEventListener('scroll', position, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open, message, warning]);

  return (
    <>
      <IconButton
        ref={triggerRef}
        className="token-charge-info"
        variant="ghost"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
        icon={
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6m0-10v.1" />
          </svg>
        }
      />
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            id={id}
            role="tooltip"
            className="token-charge-tooltip"
          >
            {warning && <strong>{warning}</strong>}
            {message}
          </div>,
          document.body,
        )}
    </>
  );
}
