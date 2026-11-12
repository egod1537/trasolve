import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type PlaceAutocompleteSuggestion,
} from '@trasolve/shared';
import { ScrollArea } from '@/shared/ui/ScrollArea';
import { useL } from '@/shared/i18n';
import { PlaceTypeIcon } from './PlaceTypeIcon';

export type SearchStatus = 'idle' | 'loading' | 'ready' | 'selecting' | 'error';

type Props = {
  status: SearchStatus;
  error: string;
  suggestions: readonly PlaceAutocompleteSuggestion[];
  onSelect: (suggestion: PlaceAutocompleteSuggestion) => Promise<void>;
};

export function PlaceSearchResults({
  status,
  error,
  suggestions,
  onSelect,
}: Props) {
  const L = useL();
  return (
    <ScrollArea
      id="map-place-search-results"
      className="map-place-search-results"
      role="listbox"
      aria-label={L('place:mapSearchToolbar.ariaLabel.placeSearchResults')}
      contentClassName="map-place-search-results-content"
    >
      {status === 'loading' && (
        <p role="status">
          {L('place:mapSearchToolbar.description.searchingLocation')}
        </p>
      )}
      {status === 'selecting' && (
        <p role="status">
          {L('place:googlePlaceCard.description.loadingLocationInformation')}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {status === 'ready' && !suggestions.length && (
        <p role="status">
          {L('place:mapSearchToolbar.description.noSearchResults')}
        </p>
      )}
      {!!suggestions.length && (
        <ul>
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                data-analytics-id={ANALYTICS_TARGETS.placeSelect}
                data-analytics-screen={ANALYTICS_SCREENS.placeSearch}
                role="option"
                aria-selected="false"
                disabled={status === 'selecting'}
                onClick={() => void onSelect(suggestion)}
              >
                <span className="map-place-search-result-title">
                  <PlaceTypeIcon types={suggestion.types} />
                  <strong>{suggestion.text}</strong>
                </span>
                <span className="map-place-search-result-address">
                  {suggestion.secondaryText ||
                    L('place:mapSearchToolbar.text.noAddressInformation')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </ScrollArea>
  );
}
