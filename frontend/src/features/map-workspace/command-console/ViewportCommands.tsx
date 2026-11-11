import type { PlaceDetails } from '@trasolve/shared';
import { useState, type RefObject } from 'react';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import { PreferencesModal } from '@/features/preferences';
import { useCommandBindings } from './CommandProvider';
import { useCommandSession } from './CommandSession';
import {
  createNetworkCommands,
  type NetworkCommandState,
} from './networkCommands';
import {
  createOptimizationCommands,
  type OptimizationCommandState,
} from './optimizationCommands';
import { resolveDay, resolvePlace } from './commandTargets';
import { downloadTripFile } from '../files/tripFiles';
import { ImportDialog } from '../files/TripFileDialogs';
import { printTripSchedule } from '../files/printTripSchedule';
import { captureView, requiresNativeCapture } from '../capture/captureView';
import type { Measurement } from '../measurement/useMeasurement';
export function ViewportCommands({
  mapRef,
  measurement,
  openOptimization,
  onPreviewPlace,
  onSelectSavedPlace,
}: {
  mapRef: RefObject<GoogleMapHandle | null>;
  measurement: Measurement;
  openOptimization: () => void;
  onPreviewPlace: (place: PlaceDetails) => void;
  onSelectSavedPlace: (id: string) => void;
}) {
  const ctx = useCommandSession();
  const [network] = useState<NetworkCommandState>(() => ({
    suggestions: [],
    routes: [],
    batches: new Map(),
  }));
  const [optimization] = useState<OptimizationCommandState>(() => ({}));
  const [settings, setSettings] = useState(false);
  const [importDay, setImportDay] = useState<string | null>(null);
  const handlers = createNetworkCommands(ctx, network);
  useCommandBindings({
    ...handlers,
    'place inspect': async (args, signal) => {
      const result = await handlers['place inspect']!(args, signal);
      signal.throwIfAborted();
      const place = result.data as PlaceDetails;
      mapRef.current?.panTo(place.location);
      onPreviewPlace(place);
      return result;
    },
    'place select': (a) => {
      const place = resolvePlace(ctx.trip, a.place, ctx.ui.selectedPlaceId);
      const day = ctx.trip.days.find((d) =>
        d.places.some((p) => p.id === place.id),
      )!;
      if (day.hidden) {
        throw new Error('DAY_HIDDEN');
      }
      onSelectSavedPlace(place.id);
      ctx.ui.focusPlace(place.id);
      return { data: place, handoff: true };
    },
    ...createOptimizationCommands(ctx, optimization, openOptimization),
    'map goto': async (a, signal) => {
      const result = await handlers['map goto']!(a, signal);
      signal.throwIfAborted();
      const point = result.data as { lat: number; lng: number };
      if (!mapRef.current) {
        throw new Error('MAP_UNAVAILABLE');
      }
      mapRef.current.panTo(point);
      return result;
    },
    'map zoom': (a) => {
      if (!mapRef.current) {
        throw new Error('MAP_UNAVAILABLE');
      }
      mapRef.current.setZoom(Number(a.zoom));
      return { data: { zoom: a.zoom } };
    },
    'map fit': (a) => {
      if (a.day !== undefined) {
        ctx.ui.focusDay(resolveDay(ctx.trip, a.day, ctx.ui.selectedDayId).id);
      } else {
        ctx.ui.showAll();
      }
      return { data: { focused: true } };
    },
    tool: (a) => {
      measurement.selectTool(String(a.tool) as 'pan' | 'distance' | 'area');
      return { data: { tool: a.tool }, handoff: true };
    },
    capture: async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await captureView(document.body, requiresNativeCapture(document.body));
      return { data: { downloaded: true } };
    },
    export: async (a) => {
      if (a.format === 'pdf') {
        await printTripSchedule(ctx.trip);
      } else {
        downloadTripFile(ctx.trip, a.format as 'kml' | 'kmz');
      }
      return { data: { format: a.format } };
    },
    import: (a) => {
      setImportDay(resolveDay(ctx.trip, a.day, ctx.ui.selectedDayId).id);
      return { handoff: true };
    },
    settings: () => {
      setSettings(true);
      return { handoff: true };
    },
  });
  const day = ctx.trip.days.find((day) => day.id === importDay);
  return (
    <>
      {settings && <PreferencesModal onClose={() => setSettings(false)} />}{' '}
      {day && (
        <ImportDialog
          dayId={day.id}
          dayTitle={day.title}
          onClose={() => setImportDay(null)}
        />
      )}
    </>
  );
}
