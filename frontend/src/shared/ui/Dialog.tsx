import {
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import '@/shared/ui/primitives.css';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type Props = {
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  id?: string;
  role?: 'dialog' | 'alertdialog';
  labelledBy: string;
  describedBy?: string;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  portal?: boolean;
  onClose: () => void;
};

export function Dialog({
  children,
  className = '',
  backdropClassName = '',
  id,
  role = 'dialog',
  labelledBy,
  describedBy,
  busy = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  portal = true,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    const target =
      initialFocusRef?.current ?? getFocusable(dialogRef.current)[0];
    (target ?? dialogRef.current)?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [initialFocusRef]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!closeOnEscape) {
      return;
    }
    const close = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', close, true);
    return () => window.removeEventListener('keydown', close, true);
  }, [closeOnEscape, onClose]);

  const trapFocus = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = getFocusable(dialogRef.current);
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>): void => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };
  const content = (
    <div
      className={`ui-dialog-backdrop ${backdropClassName}`.trim()}
      onMouseDown={closeFromBackdrop}
    >
      <section
        ref={dialogRef}
        id={id}
        className={`ui-dialog ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onKeyDown={trapFocus}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
  return portal ? createPortal(content, document.body) : content;
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  return Array.from(
    root?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
  );
}
