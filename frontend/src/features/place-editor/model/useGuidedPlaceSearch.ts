import { useEffect, useEffectEvent } from 'react';
import type { PlaceAutocompleteSuggestion } from '@trasolve/shared';

export type GuidedPlaceSearch = { query: string; autoSelect: boolean };

/** Drive the normal autocomplete/details flow without fabricated place data. */
export function useGuidedPlaceSearch(
  guided: GuidedPlaceSearch | undefined,
  status: string,
  suggestions: readonly PlaceAutocompleteSuggestion[],
  select: (suggestion: PlaceAutocompleteSuggestion) => Promise<void>,
  cancel: () => void,
) {
  const selectExample = useEffectEvent(() => {
    if (!guided?.autoSelect || status !== 'ready') {
      return;
    }
    const names = [guided.query, 'Seoul Station', 'ソウル駅'].map((name) =>
      name.toLowerCase().replaceAll(/\s/g, ''),
    );
    const station = suggestions.find((suggestion) => {
      const text = suggestion.text.toLowerCase().replaceAll(/\s/g, '');
      const isStation = suggestion.types.some((type) =>
        ['train_station', 'transit_station', 'subway_station'].includes(type),
      );
      return isStation && names.some((name) => text.includes(name));
    });
    if (station) {
      void select(station);
    }
  });
  useEffect(() => {
    selectExample();
  }, [guided?.autoSelect, suggestions, status]);
  useEffect(() => {
    if (guided?.query) {
      return cancel;
    }
  }, [guided?.query, cancel]);
}
