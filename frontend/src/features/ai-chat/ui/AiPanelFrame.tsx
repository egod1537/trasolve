import type { ReactNode, RefObject } from 'react';
import { Dialog } from '@/shared/ui/Dialog';

type Props = {
  open: boolean;
  modal: boolean;
  titleId: string;
  initialFocusRef: RefObject<HTMLTextAreaElement | null>;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
};

export function AiPanelFrame({
  open,
  modal,
  titleId,
  initialFocusRef,
  onClose,
  children,
  className: extraClassName = '',
}: Props) {
  const className =
    `trip-map-ai-panel${open ? ' is-open' : ''} ${extraClassName}`.trim();
  if (modal) {
    return (
      <Dialog
        open={open}
        id="trip-map-ai-panel"
        className={className}
        labelledBy={titleId}
        initialFocusRef={initialFocusRef}
        closeOnBackdrop={Boolean(onClose)}
        closeOnEscape={Boolean(onClose)}
        onClose={() => onClose?.()}
        portal={false}
      >
        {children}
      </Dialog>
    );
  }
  return (
    <aside
      id="trip-map-ai-panel"
      className={className}
      aria-labelledby={titleId}
      aria-hidden={!open}
      inert={!open}
    >
      {children}
    </aside>
  );
}
