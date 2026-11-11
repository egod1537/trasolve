import { AiCommands } from '../command-console/AiCommands';
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
import { useTutorial } from '@/features/onboarding';

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
  const tutorial = useTutorial();
  const guidedSearchActive = Boolean(
    tutorial?.active &&
    (tutorial.progress.step === 'search' ||
      tutorial.progress.step === 'add-place'),
  );
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
    if (guidedSearchActive) {
      return { lat: 37.5547, lng: 126.9707, radiusMeters: 3000 };
    }
    const center = mapRef.current?.getCenter();
    return center ? { ...center, radiusMeters: 50000 } : undefined;
  }, [mapRef, guidedSearchActive]);
  const selectPlace = useCallback(
    (place: PlaceDetails) => {
      mapRef.current?.panTo(place.location);
      onSelectPlace(place);
      if (tutorial?.active && tutorial.progress.step === 'search') {
        tutorial.step(3);
      }
    },
    [mapRef, onSelectPlace, tutorial],
  );

  return (
    <>
      <AiCommands />
      <div className="map-viewport-tools">
        <MapSearchToolbar
          key={dismissRevision}
          aiOpen={aiOpen}
          quickSearchShortcutLabel={quickSearchShortcutLabel}
          getSearchBias={getSearchBias}
          onOpenQuickSearch={openQuickSearch}
          onSelectPlace={selectPlace}
          guidedSearch={
            guidedSearchActive
              ? {
                  query: '서울역',
                  autoSelect: tutorial?.progress.step === 'add-place',
                }
              : undefined
          }
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
