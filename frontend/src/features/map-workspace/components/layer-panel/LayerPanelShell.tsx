import { useMobileNavigation } from '../../model/MobileNavigation';
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useLayoutMaxWidth } from '@/shared/hooks/useLayoutMaxWidth';
import { useL } from '@/shared/i18n';

type Props = {
  title: string;
  sidebarRef: RefObject<HTMLElement | null>;
  busy?: boolean;
  children: ReactNode;
};

type SheetSize = 'collapsed' | 'half' | 'full';

/** One collapsible shell for editable and shared itinerary lists. */
export function LayerPanelShell({ title, sidebarRef, busy, children }: Props) {
  const L = useL();
  const mobile = useLayoutMaxWidth();
  const contentId = useId();
  const navigation = useMobileNavigation();
  const [localSize, setLocalSize] = useState<SheetSize>(() =>
    window.innerHeight < 540 ? 'collapsed' : 'half',
  );
  const size = navigation?.sheetSize ?? localSize;
  const setSize = navigation?.setSheetSize ?? setLocalSize;
  const active = !mobile || !navigation || navigation.tab === 'layers';
  const dragStart = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const collapsed = size === 'collapsed';
  const expanded = size === 'full';
  return (
    <aside
      ref={sidebarRef}
      className="layer-panel trip-sidebar"
      data-mobile-sheet={size}
      data-mobile-active={active}
      aria-hidden={!active || undefined}
      inert={busy || !active}
      aria-label={L('map:layerPanel.ariaLabel.travelItinerary')}
    >
      <div className="mobile-layer-sheet-handle">
        <button
          type="button"
          className="mobile-layer-sheet-toggle"
          aria-label={L('map:layerPanel.ariaLabel.travelItinerary')}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) {
              return;
            }
            dragStart.current = event.clientY;
            suppressClick.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            if (dragStart.current === null) {
              return;
            }
            const distance = dragStart.current - event.clientY;
            dragStart.current = null;
            if (Math.abs(distance) < 36) {
              return;
            }
            suppressClick.current = true;
            setSize((current) =>
              distance > 0
                ? current === 'collapsed'
                  ? 'half'
                  : 'full'
                : current === 'full'
                  ? 'half'
                  : 'collapsed',
            );
          }}
          onPointerCancel={() => {
            dragStart.current = null;
          }}
          onLostPointerCapture={() => {
            dragStart.current = null;
          }}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            setSize(collapsed ? 'half' : 'collapsed');
          }}
        >
          <span className="mobile-layer-sheet-grip" aria-hidden="true" />
          <span className="mobile-layer-sheet-title">{title}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={collapsed ? 'm6 14 6-6 6 6' : 'm6 10 6 6 6-6'} />
          </svg>
        </button>
        {!collapsed && (
          <button
            type="button"
            className="mobile-layer-sheet-expand"
            aria-label={
              expanded
                ? L('map:dayLayerSection.text.fold')
                : L('map:dayLayerSection.text.expand')
            }
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setSize(expanded ? 'half' : 'full')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={expanded ? 'm6 8 6 6 6-6M6 16h12' : 'm6 12 6-6 6 6M6 18h12'}
              />
            </svg>
          </button>
        )}
      </div>
      <div
        id={contentId}
        className="mobile-layer-sheet-content"
        inert={mobile && collapsed}
      >
        {children}
      </div>
    </aside>
  );
}
