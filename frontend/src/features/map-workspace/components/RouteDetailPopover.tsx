import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MapRoute } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import type { RouteEndpoint, RoutableMode } from '../domain/routeDetails';
import { RouteDetails } from './RouteDetails';
import { useRouteDetailPlacement } from './routeDetailPlacement';

export function RouteDetailPopover({
  id,
  route,
  index,
  mode,
  from,
  to,
  trigger,
  onClose,
}: {
  id: string;
  route: MapRoute;
  index: number;
  mode: RoutableMode;
  from: RouteEndpoint;
  to: RouteEndpoint;
  trigger: HTMLButtonElement;
  onClose: (restoreFocus: boolean) => void;
}) {
  const L = useL();
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const style = useRouteDetailPlacement(trigger);
  useEffect(() => {
    const focusFrame = requestAnimationFrame(() => {
      closeRef.current?.focus({ preventScroll: true });
    });
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !ref.current?.contains(event.target) &&
        !trigger.contains(event.target)
      ) {
        onClose(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose(true);
      }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [onClose, trigger]);
  return createPortal(
    <aside
      ref={ref}
      id={id}
      className="route-detail-popover"
      style={style}
      role="dialog"
      data-layer-interactive-popover
      aria-labelledby={`${id}-title`}
    >
      <header>
        <div>
          <span>
            {L('testbed:routeResultPanel.text.path', { value: index + 1 })}
          </span>
          <h3 id={`${id}-title`}>
            {L('testbed:routeResultPanel.title.routeBySection')}
          </h3>
        </div>
        <IconButton
          ref={closeRef}
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          aria-label={L('common:action.close')}
          onClick={() => onClose(true)}
        />
      </header>
      <ScrollArea
        className="route-detail-popover-body"
        contentClassName="route-detail-popover-body-content"
        viewportProps={{
          role: 'region',
          tabIndex: 0,
          'aria-label': L('testbed:routeResultPanel.title.routeBySection'),
        }}
      >
        <RouteDetails
          route={route}
          mode={mode}
          fromName={from.name}
          toName={to.name}
        />
      </ScrollArea>
    </aside>,
    document.body,
  );
}
