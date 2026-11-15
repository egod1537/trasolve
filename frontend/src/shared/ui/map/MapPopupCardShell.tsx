import { useId, type ReactNode, type RefObject } from 'react';
import { CloseIcon } from '@/shared/ui/icons';
import { IconButton } from '@/shared/ui/IconButton';
import '@/shared/ui/map/place-info-card.css';

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  cardRef?: RefObject<HTMLElement | null>;
  closeLabel: string;
  headerActions?: ReactNode;
  headerActionsLayout?: 'inline' | 'stacked-below-close';
  children: ReactNode;
  onClose: () => void;
};

export function MapPopupCardShell({
  title,
  subtitle,
  className,
  cardRef,
  closeLabel,
  headerActions,
  headerActionsLayout = 'inline',
  children,
  onClose,
}: Props) {
  const titleId = useId();
  const closeButton = (
    <IconButton
      className="place-info-card-close"
      aria-label={closeLabel}
      size="sm"
      variant="ghost"
      icon={<CloseIcon />}
      onClick={onClose}
    />
  );

  return (
    <aside
      ref={cardRef}
      className={`place-info-card${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <header className="place-info-card-header">
        <div className="place-info-card-header-copy">
          <h2 id={titleId}>{title}</h2>
          {subtitle}
        </div>
        <div
          className={`place-info-card-header-actions${
            headerActionsLayout === 'stacked-below-close' ? ' is-stacked' : ''
          }`}
        >
          {headerActionsLayout === 'stacked-below-close' ? (
            <>
              {closeButton}
              {headerActions}
            </>
          ) : (
            <>
              {headerActions}
              {closeButton}
            </>
          )}
        </div>
      </header>
      {children}
    </aside>
  );
}
