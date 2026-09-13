import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type {
  PlaceAutocompleteRequest,
  PlaceAutocompleteSuggestion,
  PlaceDetails,
} from '@trasolve/shared';
import { getPlace, searchPlaces } from '../../../../api/places';
import { PlaceTypeIcon } from '../PlaceTypeIcon';
import '../../styles/map-toolbar.css';

type SearchStatus = 'idle' | 'loading' | 'ready' | 'selecting' | 'error';
type SearchBias = PlaceAutocompleteRequest['locationBias'];

const SEARCH_DEBOUNCE_MS = 300;

type Props = {
  aiOpen: boolean;
  quickSearchShortcutLabel: string;
  getSearchBias: () => SearchBias;
  onOpenQuickSearch: () => void;
  onSelectPlace: (place: PlaceDetails) => void;
};

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

export const MapSearchToolbar = memo(function MapSearchToolbar({
  aiOpen,
  quickSearchShortcutLabel,
  getSearchBias,
  onOpenQuickSearch,
  onSelectPlace,
}: Props) {
  const [query, setQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchError, setSearchError] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceAutocompleteSuggestion[]>(
    [],
  );
  const searchRootRef = useRef<HTMLDivElement>(null);
  const searchRequestRef = useRef<AbortController | null>(null);
  const detailsRequestRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const skipNextQuerySearchRef = useRef(false);
  const dropdownOpen = searchStatus !== 'idle';

  const clearSearchDebounce = useCallback(() => {
    if (debounceTimerRef.current === null) {
      return;
    }
    window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = null;
  }, []);

  const closeResults = useCallback(() => {
    clearSearchDebounce();
    searchRequestRef.current?.abort();
    searchRequestRef.current = null;
    detailsRequestRef.current?.abort();
    detailsRequestRef.current = null;
    sessionTokenRef.current = null;
    setSuggestions([]);
    setSearchError('');
    setSearchStatus('idle');
  }, [clearSearchDebounce]);

  const searchAutocomplete = useCallback(
    async (input: string) => {
      clearSearchDebounce();
      searchRequestRef.current?.abort();
      detailsRequestRef.current?.abort();
      detailsRequestRef.current = null;
      setSuggestions([]);
      setSearchError('');

      const request = new AbortController();
      const sessionToken = sessionTokenRef.current ?? crypto.randomUUID();
      sessionTokenRef.current = sessionToken;
      searchRequestRef.current = request;
      setSearchStatus('loading');
      try {
        const result = await searchPlaces(input, {
          languageCode: 'ko',
          sessionToken,
          locationBias: getSearchBias(),
          signal: request.signal,
        });
        if (request.signal.aborted || searchRequestRef.current !== request) {
          return;
        }
        searchRequestRef.current = null;
        setSuggestions(result.suggestions.slice(0, 8));
        setSearchStatus('ready');
      } catch {
        if (request.signal.aborted || searchRequestRef.current !== request) {
          return;
        }
        searchRequestRef.current = null;
        setSearchStatus('error');
        setSearchError('장소 검색에 실패했습니다. 다시 시도해 주세요.');
      }
    },
    [clearSearchDebounce, getSearchBias],
  );

  useEffect(() => {
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !searchRootRef.current?.contains(event.target)
      ) {
        closeResults();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [closeResults]);

  useEffect(
    () => () => {
      clearSearchDebounce();
      searchRequestRef.current?.abort();
      detailsRequestRef.current?.abort();
    },
    [clearSearchDebounce],
  );

  useEffect(() => {
    if (skipNextQuerySearchRef.current) {
      skipNextQuerySearchRef.current = false;
      return;
    }
    const input = query.trim();
    if (input.length < 2) {
      clearSearchDebounce();
      searchRequestRef.current?.abort();
      searchRequestRef.current = null;
      sessionTokenRef.current = null;
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void searchAutocomplete(input);
    }, SEARCH_DEBOUNCE_MS);
    return clearSearchDebounce;
  }, [clearSearchDebounce, query, searchAutocomplete]);

  const runSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = query.trim();
    clearSearchDebounce();
    searchRequestRef.current?.abort();
    if (input.length < 2) {
      searchRequestRef.current = null;
      detailsRequestRef.current?.abort();
      detailsRequestRef.current = null;
      sessionTokenRef.current = null;
      setSuggestions([]);
      setSearchStatus('error');
      setSearchError('검색어를 두 글자 이상 입력해 주세요.');
      return;
    }
    void searchAutocomplete(input);
  };

  const selectSuggestion = async (suggestion: PlaceAutocompleteSuggestion) => {
    searchRequestRef.current?.abort();
    searchRequestRef.current = null;
    clearSearchDebounce();
    detailsRequestRef.current?.abort();
    const request = new AbortController();
    detailsRequestRef.current = request;
    setSearchStatus('selecting');
    setSearchError('');
    try {
      const place = await getPlace(suggestion.placeId, {
        languageCode: 'ko',
        sessionToken: sessionTokenRef.current ?? undefined,
        signal: request.signal,
      });
      if (request.signal.aborted || detailsRequestRef.current !== request) {
        return;
      }
      detailsRequestRef.current = null;
      sessionTokenRef.current = null;
      onSelectPlace(place);
      if (place.name !== query) {
        skipNextQuerySearchRef.current = true;
        setQuery(place.name);
      }
      setSuggestions([]);
      setSearchStatus('idle');
    } catch {
      if (request.signal.aborted || detailsRequestRef.current !== request) {
        return;
      }
      detailsRequestRef.current = null;
      setSearchStatus('error');
      setSearchError('장소 정보를 불러오지 못했습니다. 다시 선택해 주세요.');
    }
  };

  return (
    <div className="map-toolbar-positioner" data-ai-open={aiOpen}>
      <div className="map-toolbar" role="search" aria-label="지도 장소 검색">
        <div className="map-toolbar-search-line">
          <div
            ref={searchRootRef}
            className="map-toolbar-search-root"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              closeResults();
            }}
          >
            <form
              className="map-toolbar-search"
              aria-busy={
                searchStatus === 'loading' || searchStatus === 'selecting'
              }
              onSubmit={(event) => void runSearch(event)}
            >
              <input
                type="search"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="map-place-search-results"
                aria-expanded={dropdownOpen}
                aria-label="장소 검색"
                placeholder="장소 검색"
                value={query}
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  clearSearchDebounce();
                  searchRequestRef.current?.abort();
                  searchRequestRef.current = null;
                  detailsRequestRef.current?.abort();
                  detailsRequestRef.current = null;
                  setQuery(nextQuery);
                  setSuggestions([]);
                  setSearchError('');
                  setSearchStatus('idle');
                  if (nextQuery.trim().length < 2) {
                    sessionTokenRef.current = null;
                  }
                }}
              />
              <button
                type="submit"
                aria-label="검색"
                title="장소 검색"
                disabled={
                  searchStatus === 'loading' || searchStatus === 'selecting'
                }
              >
                <Icon path="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6" />
              </button>
            </form>
            {dropdownOpen && (
              <div
                id="map-place-search-results"
                className="map-place-search-results"
                role="listbox"
                aria-label="장소 검색 결과"
              >
                {searchStatus === 'loading' && (
                  <p role="status">장소를 검색하고 있습니다.</p>
                )}
                {searchStatus === 'selecting' && (
                  <p role="status">장소 정보를 불러오고 있습니다.</p>
                )}
                {searchError && <p role="alert">{searchError}</p>}
                {searchStatus === 'ready' && !suggestions.length && (
                  <p role="status">검색 결과가 없습니다</p>
                )}
                {!!suggestions.length && (
                  <ul>
                    {suggestions.map((suggestion) => (
                      <li key={suggestion.placeId}>
                        <button
                          type="button"
                          role="option"
                          aria-selected="false"
                          disabled={searchStatus === 'selecting'}
                          onClick={() => void selectSuggestion(suggestion)}
                        >
                          <span className="map-place-search-result-title">
                            <PlaceTypeIcon types={suggestion.types} />
                            <strong>{suggestion.text}</strong>
                          </span>
                          <span className="map-place-search-result-address">
                            {suggestion.secondaryText || '주소 정보 없음'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="map-toolbar-quick-search-trigger"
            aria-label={`빠른 검색 열기 (${quickSearchShortcutLabel})`}
            title={`빠른 검색 (${quickSearchShortcutLabel})`}
            onClick={onOpenQuickSearch}
          >
            <Icon path="M5 6h14M5 12h9M5 18h6" />
            <kbd>{quickSearchShortcutLabel}</kbd>
          </button>
        </div>
      </div>
    </div>
  );
});
