import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from 'react';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import { TripSaveStatus } from './TripSaveStatus';
import type { Trip } from '@/entities/trip';
import { InlineRename } from '@/shared/ui/InlineRename';
import { useL } from '@/shared/i18n';
import { trackEvent } from '@/shared/analytics';
import { TripExportDialog } from '../../files/TripFileDialogs';

type Props = {
  trip: Trip;
  onAddLayer: () => void;
  onShareTrip: () => void;
  shareButtonRef: RefObject<HTMLButtonElement | null>;
  onRenameTrip: (title: string) => void;
};

function ActionIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

export const LayerPanelHeader = memo(function LayerPanelHeader({
  trip,
  onAddLayer,
  onShareTrip,
  shareButtonRef,
  onRenameTrip,
}: Props) {
  const L = useL();
  const [titleEditing, setTitleEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const menuId = useId();
  const placeCount = trip.days.reduce(
    (total, day) => total + day.places.length,
    0,
  );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const commitTitle = (draft: string) => {
    const title = draft.trim();
    setTitleEditing(false);
    if (title && title !== trip.title) {
      onRenameTrip(title);
    }
  };
  const startTitleEditing = () => {
    setMenuOpen(false);
    setTitleEditing(true);
  };

  return (
    <header ref={rootRef} className="trip-sidebar-header">
      <div className="trip-panel-header-body">
        <div className="trip-panel-header-copy">
          <h1 className="trip-plan-title">
            {titleEditing ? (
              <InlineRename
                value={trip.title}
                ariaLabel={L(
                  'map:layerPanelHeader.ariaLabel.editTravelPlanName',
                )}
                className="trip-plan-title-input"
                onCommit={commitTitle}
                onCancel={() => setTitleEditing(false)}
              />
            ) : (
              <span
                className="trip-plan-title-text"
                title={L(
                  'map:layerPanelHeader.tooltip.doubleClickEditTripName',
                )}
                onDoubleClick={startTitleEditing}
              >
                {trip.title}
              </span>
            )}
          </h1>
          <p className="trip-panel-header-meta">
            {L('map:layerPanelHeader.text.dayPcsPlacePcs', {
              length: trip.days.length,
              placeCount: placeCount,
            })}
          </p>
          <TripSaveStatus />
        </div>

        <div className="trip-panel-header-menu-anchor">
          <button
            type="button"
            className="trip-panel-header-menu-trigger"
            aria-label={L('map:layerPanelHeader.ariaLabel.travelOptions')}
            title={L('map:layerPanelHeader.ariaLabel.travelOptions')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="5" r="1.25" />
              <circle cx="12" cy="12" r="1.25" />
              <circle cx="12" cy="19" r="1.25" />
            </svg>
          </button>
          {menuOpen && (
            <div id={menuId} className="trip-panel-header-menu" role="menu">
              <button type="button" role="menuitem" onClick={startTitleEditing}>
                {L('map:layerPanelHeader.action.changeTourName')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="trip-panel-header-actions" data-tutorial="trip-actions">
        <button
          type="button"
          className="trip-panel-header-action"
          aria-label={L('map:layer.add')}
          data-tutorial="add-day"
          onClick={onAddLayer}
        >
          <ActionIcon>
            <path d="M12 5v14M5 12h14" />
          </ActionIcon>
          <span>{L('map:layer.add')}</span>
        </button>
        <button
          ref={shareButtonRef}
          type="button"
          className="trip-panel-header-action"
          data-analytics-id={ANALYTICS_TARGETS.shareOpen}
          data-analytics-screen={ANALYTICS_SCREENS.mapWorkspace}
          aria-label={L('map:layerPanelHeader.ariaLabel.shareTrip')}
          title={L('map:layerPanelHeader.ariaLabel.shareTrip')}
          onClick={() => {
            trackEvent({
              eventType: 'button_click',
              screen: ANALYTICS_SCREENS.mapWorkspace,
              target: ANALYTICS_TARGETS.shareOpen,
            });
            onShareTrip();
          }}
        >
          <ActionIcon>
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.5m-7.6 6.9 7.6 4.5" />
          </ActionIcon>
          <span>{L('map:layerPanelHeader.text.share')}</span>
        </button>
        <button
          type="button"
          className="trip-panel-header-action"
          onClick={() => setExportOpen(true)}
        >
          <ActionIcon>
            <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
          </ActionIcon>
          <span>{L('map:tripFiles.exportAction')}</span>
        </button>
      </div>
      {exportOpen && <TripExportDialog onClose={() => setExportOpen(false)} />}
    </header>
  );
});
