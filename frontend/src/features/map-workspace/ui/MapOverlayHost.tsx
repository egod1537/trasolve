import { memo, useEffect, useRef, type RefObject } from 'react';
import { useTutorial } from '@/features/onboarding';
import type { Measurement } from '../measurement/useMeasurement';
import { MeasurementPanel } from '../measurement/MeasurementPanel';
import { useViewCapture } from '../capture/useViewCapture';
import type { TripDay, TripPolyline, TripPolylineMode } from '@trasolve/shared';
import { BottomContextPanel } from '@/features/map-workspace/components/bottom-panel/BottomContextPanel';
import { MapToolPanel } from '@/features/map-workspace/components/bottom-panel/MapToolPanel';
import { MultiSelectionActionPanel } from '@/features/map-workspace/components/bottom-panel/MultiSelectionActionPanel';
import {
  RouteOptimizationModal,
  type RouteComparisonData,
} from '@/features/route-optimization';

type Props = {
  onCompare: (data: RouteComparisonData) => void;
  activeDay: TripDay | null;
  days: readonly TripDay[];
  measurement: Measurement;
  routeOptimizationOpen: boolean;
  routeOptimizationModalId: string;
  routeToolButtonRef: RefObject<HTMLButtonElement | null>;
  selectedItemCount: number;
  selectedPlaceIds: readonly string[];
  selectedPolylines: readonly TripPolyline[];
  busy: boolean;
  mutationError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleRouteOptimization: () => void;
  onCloseRouteOptimization: () => void;
  onUpdatePolylineModes: (
    polylineIds: readonly string[],
    mode: TripPolylineMode,
  ) => Promise<boolean>;
  onDeletePlaces: (placeIds: readonly string[]) => Promise<boolean>;
  onClearSelection: () => void;
};

export const MapOverlayHost = memo(function MapOverlayHost({
  onCompare,
  activeDay,
  days,
  measurement,
  routeOptimizationOpen,
  routeOptimizationModalId,
  routeToolButtonRef,
  selectedItemCount,
  selectedPlaceIds,
  selectedPolylines,
  busy,
  mutationError,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onToggleRouteOptimization,
  onCloseRouteOptimization,
  onUpdatePolylineModes,
  onDeletePlaces,
  onClearSelection,
}: Props) {
  const capture = useViewCapture();
  const tutorial = useTutorial();
  const routeToolsWereOpen = useRef(routeOptimizationOpen);
  useEffect(() => {
    if (
      routeToolsWereOpen.current &&
      !routeOptimizationOpen &&
      tutorial?.active &&
      tutorial.progress.step === 'optimize'
    ) {
      tutorial.step(5);
    }
    routeToolsWereOpen.current = routeOptimizationOpen;
  }, [routeOptimizationOpen, tutorial]);
  const measuring = measurement.tool !== 'pan';
  return (
    <>
      <div className="bottom-map-controls-positioner">
        {capture.message && (
          <p className="map-capture-status" role="status" data-capture-ignore>
            {capture.message}
          </p>
        )}
        <MeasurementPanel measurement={measurement} />
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
            captureBusy={capture.busy}
            onCapture={() => void capture.capture()}
            canUndo={measuring ? measurement.points.length > 0 : canUndo}
            canRedo={!measuring && canRedo}
            activeTool={measurement.tool}
            onUndo={measuring ? measurement.undo : onUndo}
            onRedo={onRedo}
            onSelectTool={measurement.selectTool}
            onOpenRouteTools={
              days.length > 0
                ? () => {
                    measurement.selectTool('pan');
                    onToggleRouteOptimization();
                  }
                : undefined
            }
            routeToolsOpen={routeOptimizationOpen && days.length > 0}
            routeToolsControlId={routeOptimizationModalId}
            routeToolButtonRef={routeToolButtonRef}
          />
        </div>
      </div>
      {routeOptimizationOpen && days.length > 0 && (
        <RouteOptimizationModal
          id={routeOptimizationModalId}
          days={days}
          initialDayId={activeDay?.id}
          onClose={onCloseRouteOptimization}
          onCompare={onCompare}
        />
      )}
    </>
  );
});
