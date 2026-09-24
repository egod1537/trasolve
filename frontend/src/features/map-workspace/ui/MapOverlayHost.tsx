import { lazy, memo, Suspense, type RefObject } from 'react';
import type { TripDay, TripPolyline, TripPolylineMode } from '@trasolve/shared';
import { BottomContextPanel } from '@/features/map-workspace/components/bottom-panel/BottomContextPanel';
import { MapToolPanel } from '@/features/map-workspace/components/bottom-panel/MapToolPanel';
import { MultiSelectionActionPanel } from '@/features/map-workspace/components/bottom-panel/MultiSelectionActionPanel';

const RouteOptimizationModal = lazy(() =>
  import('@/features/route-optimization').then((module) => ({
    default: module.RouteOptimizationModal,
  })),
);

const noop = () => undefined;

type Props = {
  activeDay: TripDay | null;
  days: readonly TripDay[];
  activeMapTool: 'pan';
  routeOptimizationOpen: boolean;
  routeOptimizationModalId: string;
  routeToolButtonRef: RefObject<HTMLButtonElement | null>;
  selectedItemCount: number;
  selectedPlaceIds: readonly string[];
  selectedPolylines: readonly TripPolyline[];
  busy: boolean;
  mutationError: string | null;
  onSelectMapTool: (tool: 'pan') => void;
  onToggleRouteOptimization: () => void;
  onCloseRouteOptimization: () => void;
  onUpdatePolylineModes: (
    polylineIds: readonly string[],
    mode: TripPolylineMode,
  ) => Promise<boolean>;
  onDeletePlaces: (placeIds: readonly string[]) => Promise<boolean>;
  onClearSelection: () => void;
  onApplyOptimizedRoute: (
    dayId: string,
    placeIds: readonly string[],
  ) => Promise<boolean>;
};

export const MapOverlayHost = memo(function MapOverlayHost({
  activeDay,
  days,
  activeMapTool,
  routeOptimizationOpen,
  routeOptimizationModalId,
  routeToolButtonRef,
  selectedItemCount,
  selectedPlaceIds,
  selectedPolylines,
  busy,
  mutationError,
  onSelectMapTool,
  onToggleRouteOptimization,
  onCloseRouteOptimization,
  onUpdatePolylineModes,
  onDeletePlaces,
  onClearSelection,
  onApplyOptimizedRoute,
}: Props) {
  return (
    <>
      <div className="bottom-map-controls-positioner">
        {selectedItemCount >= 2 && (
          <MultiSelectionActionPanel
            selectedPlaceIds={selectedPlaceIds}
            selectedPolylines={selectedPolylines}
            busy={busy}
            mutationError={mutationError}
            onUpdatePolylineModes={onUpdatePolylineModes}
            onDeletePlaces={onDeletePlaces}
            onClearSelection={onClearSelection}
          />
        )}
        <div className="bottom-map-controls">
          <BottomContextPanel activeDay={activeDay} />
          <MapToolPanel
            canUndo={false}
            canRedo={false}
            activeTool={activeMapTool}
            onUndo={noop}
            onRedo={noop}
            onSelectTool={onSelectMapTool}
            onOpenRouteTools={
              days.length > 0 ? onToggleRouteOptimization : undefined
            }
            routeToolsOpen={routeOptimizationOpen && days.length > 0}
            routeToolsControlId={routeOptimizationModalId}
            routeToolButtonRef={routeToolButtonRef}
          />
        </div>
      </div>
      {routeOptimizationOpen && days.length > 0 && (
        <Suspense fallback={null}>
          <RouteOptimizationModal
            id={routeOptimizationModalId}
            days={days}
            initialDayId={activeDay?.id}
            onClose={onCloseRouteOptimization}
            onApply={onApplyOptimizedRoute}
          />
        </Suspense>
      )}
    </>
  );
});
