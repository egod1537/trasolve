import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import '@/shared/ui/map/place-info-card.css';
import { useAnchoredSideCardPlacement } from '@/shared/hooks/useAnchoredSideCardPlacement';
import { CloseIcon } from '@/shared/ui/icons';

type Props = {
  id?: string;
  title: ReactNode;
  className?: string;
  groupRef: RefObject<HTMLElement | null>;
  mainCardRef: RefObject<HTMLElement | null>;
  closeLabel: string;
  children: ReactNode;
  onClose: () => void;
};

export function SideDetailCard({
  id,
  title,
  className,
  groupRef,
  mainCardRef,
  closeLabel,
  children,
  onClose,
}: Props) {
  const generatedId = useId();
  const cardId = id ?? generatedId;
  const titleId = `${cardId}-title`;
  const sideCardRef = useRef<HTMLElement>(null);
  const placement = useAnchoredSideCardPlacement({
    open: true,
    groupRef,
    mainCardRef,
    sideCardRef,
  });

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !groupRef.current?.contains(event.target)
      ) {
        onClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [groupRef, onClose]);

  return (
    <aside
      ref={sideCardRef}
      id={cardId}
      className={`side-detail-card is-${placement}${
        className ? ` ${className}` : ''
      }`}
      role="dialog"
      aria-labelledby={titleId}
    >
      <header className="side-detail-card-header">
        <h3 id={titleId}>{title}</h3>
        <button type="button" aria-label={closeLabel} onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      {children}
    </aside>
  );
}
