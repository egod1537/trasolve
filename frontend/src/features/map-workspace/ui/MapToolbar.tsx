import { memo, useCallback, useState, type RefObject } from 'react';
import type { PlaceDetails } from '@trasolve/shared';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import { TripAiRegion } from './TripAiRegion';
import {
  getQuickSearchShortcutLabel,
  QuickSearch,
} from '@/features/map-workspace/components/quick-search/QuickSearch';
import { MapSearchToolbar } from '@/features/place-editor';
import { MapUserControls } from '@/features/auth';
import { RenderProfiler } from '@/shared/lib/RenderProfiler';

type Props = {
  suspended?: boolean;
  dismissRevision: number;
  mapRef: RefObject<GoogleMapHandle | null>;
  selectedPlaceIds: readonly string[];
  onSelectPlace: (place: PlaceDetails) => void;
  onOpenTripPicker: () => void;
};

export const MapToolbar = memo(function MapToolbar({
  suspended = false,
  dismissRevision,
  mapRef,
  selectedPlaceIds,
  onSelectPlace,
  onOpenTripPicker,
}: Props) {
  const [aiOpen, setAiOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchShortcutLabel] = useState(getQuickSearchShortcutLabel);
  const openQuickSearch = useCallback(() => {
    if (!suspended) {
      setQuickSearchOpen(true);
    }
  }, [suspended]);
  const closeQuickSearch = useCallback(() => setQuickSearchOpen(false), []);
  const getSearchBias = useCallback(() => {
    const center = mapRef.current?.getCenter();
    return center ? { ...center, radiusMeters: 50000 } : undefined;
  }, [mapRef]);
  const selectPlace = useCallback(
    (place: PlaceDetails) => {
      mapRef.current?.panTo(place.location);
      onSelectPlace(place);
    },
    [mapRef, onSelectPlace],
  );

  return (
    <>
      <div className="map-viewport-tools">
        <MapSearchToolbar
          key={dismissRevision}
          aiOpen={aiOpen}
          quickSearchShortcutLabel={quickSearchShortcutLabel}
          getSearchBias={getSearchBias}
          onOpenQuickSearch={openQuickSearch}
          onSelectPlace={selectPlace}
        />
        <MapUserControls onOpenTripPicker={onOpenTripPicker} />
      </div>
      <RenderProfiler id="map-ai-panel">
        <TripAiRegion
          open={aiOpen}
          onOpenChange={setAiOpen}
          selectedPlaceIds={selectedPlaceIds}
        />
      </RenderProfiler>
      {!suspended && (
        <QuickSearch
          open={quickSearchOpen}
          shortcutLabel={quickSearchShortcutLabel}
          onOpen={openQuickSearch}
          onClose={closeQuickSearch}
        />
      )}
    </>
  );
});
