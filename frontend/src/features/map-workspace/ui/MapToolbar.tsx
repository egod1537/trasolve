import { memo, useCallback, useState, type RefObject } from 'react';
import type { PlaceDetails } from '@trasolve/shared';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import { MapAiRegion } from '@/features/ai-chat';
import {
  getQuickSearchShortcutLabel,
  QuickSearch,
} from '@/features/map-workspace/components/quick-search/QuickSearch';
import { MapSearchToolbar } from '@/features/place-editor';
import { MapUserControls } from '@/features/auth';
import { RenderProfiler } from '@/shared/lib/RenderProfiler';

type Props = {
  dismissRevision: number;
  mapRef: RefObject<GoogleMapHandle | null>;
  onSelectPlace: (place: PlaceDetails) => void;
};

export const MapToolbar = memo(function MapToolbar({
  dismissRevision,
  mapRef,
  onSelectPlace,
}: Props) {
  const [aiOpen, setAiOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [quickSearchShortcutLabel] = useState(getQuickSearchShortcutLabel);
  const openQuickSearch = useCallback(() => setQuickSearchOpen(true), []);
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
        {!aiOpen && <MapUserControls />}
      </div>
      <RenderProfiler id="map-ai-panel">
        <MapAiRegion open={aiOpen} onOpenChange={setAiOpen} />
      </RenderProfiler>
      <QuickSearch
        open={quickSearchOpen}
        shortcutLabel={quickSearchShortcutLabel}
        onOpen={openQuickSearch}
        onClose={closeQuickSearch}
      />
    </>
  );
});
