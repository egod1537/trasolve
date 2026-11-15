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
const activeDialogs: symbol[] = [];
let scrollLocks = 0;
let previousBodyOverflow = '';

type Props = {
  children: ReactNode;
  accessory?: ReactNode;
  /** Hide without unmounting children, preserving drafts and in-flight work. */
  open?: boolean;
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
  accessory,
  open = true,
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
  const backdropRef = useRef<HTMLDivElement>(null);
  const identity = useRef(Symbol('dialog'));

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const key = identity.current;
    activeDialogs.push(key);
    return () => {
      const index = activeDialogs.indexOf(key);
      if (index !== -1) {
        activeDialogs.splice(index, 1);
      }
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const previousFocus = document.activeElement;
    const target =
      initialFocusRef?.current ?? getFocusable(dialogRef.current)[0];
    (target ?? dialogRef.current)?.focus({ preventScroll: true });
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (scrollLocks === 0) {
      previousBodyOverflow = document.body.style.overflow;
    }
    scrollLocks += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) {
      return;
    }
    const close = (event: globalThis.KeyboardEvent): void => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        activeDialogs.at(-1) === identity.current
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [closeOnEscape, onClose, open]);

  const trapFocus = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Tab' || activeDialogs.at(-1) !== identity.current) {
      return;
    }
    const focusable = getFocusable(backdropRef.current);
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
      ref={backdropRef}
      className={`ui-dialog-backdrop ${backdropClassName}`.trim()}
      hidden={!open}
      inert={!open}
      role={accessory ? role : undefined}
      aria-modal={accessory ? true : undefined}
      aria-labelledby={accessory ? labelledBy : undefined}
      aria-describedby={accessory ? describedBy : undefined}
      aria-busy={accessory ? busy || undefined : undefined}
      onKeyDown={accessory ? trapFocus : undefined}
      onMouseDown={closeFromBackdrop}
    >
      <section
        ref={dialogRef}
        id={id}
        className={`ui-dialog ${className}`.trim()}
        role={accessory ? undefined : role}
        aria-modal={accessory ? undefined : true}
        aria-labelledby={accessory ? undefined : labelledBy}
        aria-describedby={accessory ? undefined : describedBy}
        aria-busy={busy || undefined}
        tabIndex={-1}
        onKeyDown={accessory ? undefined : trapFocus}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
      {accessory && (
        <div
          className="ui-dialog-accessory"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {accessory}
        </div>
      )}
    </div>
  );
  return portal ? createPortal(content, document.body) : content;
}

function getFocusable(root: HTMLElement | null): HTMLElement[] {
  return Array.from(
    root?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
  ).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden',
  );
}
