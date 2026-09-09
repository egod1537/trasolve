import type { RefObject } from 'react';
import type { Trip } from '../../domain/trip';
import type { SelectionProps } from './DayLayerSection';
import { LayerPanelHeader } from './LayerPanelHeader';
import { LayerPanelContent } from './LayerPanelContent';
import { LayerPanelFooter } from './LayerPanelFooter';

type Props = SelectionProps & {
  trip: Trip;
  busy: boolean;
  sidebarRef: RefObject<HTMLElement | null>;
  onShowAll: () => void;
  onMovePlace: (dayId: string, placeId: string, targetIndex: number) => void;
  selectionRevision: number;
};

export function LayerPanel({
  trip,
  busy,
  sidebarRef,
  onShowAll,
  ...contentProps
}: Props) {
  return (
    <aside
      ref={sidebarRef}
      className="layer-panel trip-sidebar"
      inert={busy}
      aria-label="여행 일정"
    >
      <LayerPanelHeader trip={trip} onShowAll={onShowAll} />
      <LayerPanelContent days={trip.days} {...contentProps} />
      <LayerPanelFooter />
    </aside>
  );
}
