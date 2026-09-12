import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { PlaceAutocompleteSuggestion } from '@trasolve/shared';
import { getPlace, searchPlaces } from '../../../../api/places';
import type { MapPlace } from '../../../../map/types/googleMapComponent';
import '../../styles/google-place-search.css';

type Props = {
  label?: string;
  placeholder?: string;
  className?: string;
  onSelect: (place: MapPlace) => void;
  onError?: (error: Error) => void;
};

export function GooglePlaceSearch({
  label = '장소 검색',
  placeholder = '장소 또는 주소 입력',
  className,
  onSelect,
  onError,
}: Props) {
  const inputId = useId();
  const listId = useId();
  const statusId = useId();
  const errorId = useId();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState<{ input: string } | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceAutocompleteSuggestion[]>(
    [],
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('2자 이상 입력해 주세요.');
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const sessionToken = useRef<string | undefined>(undefined);
  const composing = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);
  const callbacks = useRef({ onSelect, onError });
  useLayoutEffect(() => {
    callbacks.current = { onSelect, onError };
  });

  const cancelRequests = useCallback(() => {
    revision.current++;
    controller.current?.abort();
    controller.current = null;
  }, []);

  const fail = useCallback((cause: unknown) => {
    const failure =
      cause instanceof Error ? cause : new Error('장소 조회에 실패했습니다.');
    setStatus('');
    setError(failure.message);
    callbacks.current.onError?.(failure);
  }, []);

  useEffect(() => cancelRequests, [cancelRequests]);

  useEffect(() => {
    if (!query) {
      return;
    }
    const request = ++revision.current;
    const current = new AbortController();
    controller.current = current;
    const timer = window.setTimeout(async () => {
      if (current.signal.aborted || request !== revision.current) {
        return;
      }
      try {
        sessionToken.current ??= crypto.randomUUID();
        const result = await searchPlaces(query.input, {
          sessionToken: sessionToken.current,
          signal: current.signal,
        });
        if (current.signal.aborted || request !== revision.current) {
          return;
        }
        setSuggestions(result.suggestions);
        setActiveIndex(-1);
        setOpen(result.suggestions.length > 0);
        setStatus(
          result.suggestions.length
            ? `${result.suggestions.length}개의 검색 결과가 있습니다.`
            : '검색 결과가 없습니다.',
        );
      } catch (cause) {
        if (!current.signal.aborted && request === revision.current) {
          fail(cause);
        }
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      current.abort();
    };
  }, [query, fail]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      listRef.current?.children[activeIndex]?.scrollIntoView({
        block: 'nearest',
      });
    }
  }, [open, activeIndex]);

  function updateInput(value: string) {
    // Invalidate immediately, including during the next debounce window.
    cancelRequests();
    setInput(value);
    setError(null);
    setSuggestions([]);
    setActiveIndex(-1);
    setOpen(false);
    const ready = value.trim().length >= 2 && !composing.current;
    setQuery(ready ? { input: value.trim() } : null);
    setStatus(ready ? '장소를 검색하고 있습니다.' : '2자 이상 입력해 주세요.');
    if (!value.trim()) {
      sessionToken.current = undefined;
    }
  }

  function dismiss() {
    cancelRequests();
    setQuery(null);
    setOpen(false);
    setActiveIndex(-1);
    setStatus('');
    sessionToken.current = undefined;
  }

  async function selectSuggestion(suggestion: PlaceAutocompleteSuggestion) {
    cancelRequests();
    setQuery(null);
    setInput(suggestion.text);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setError(null);
    setStatus('장소 정보를 불러오고 있습니다.');
    const request = revision.current;
    const current = new AbortController();
    controller.current = current;
    const token = sessionToken.current;
    // A details request ends this autocomplete session, even if it fails.
    sessionToken.current = undefined;
    try {
      const place = await getPlace(suggestion.placeId, {
        sessionToken: token,
        signal: current.signal,
      });
      if (current.signal.aborted || request !== revision.current) {
        return;
      }
      setInput(place.name);
      setStatus(`${place.name} 선택 완료`);
      callbacks.current.onSelect({
        id: place.id,
        name: place.name,
        address: place.address,
        location: place.location,
      });
    } catch (cause) {
      if (!current.signal.aborted && request === revision.current) {
        fail(cause);
      }
    }
  }

  return (
    <div className={`google-place-search ${className ?? ''}`}>
      <label htmlFor={inputId}>{label}</label>
      <div className="google-place-search-field">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          aria-describedby={`${statusId}${error ? ` ${errorId}` : ''}`}
          autoComplete="off"
          maxLength={1024}
          placeholder={placeholder}
          value={input}
          onChange={(event) => updateInput(event.target.value)}
          onFocus={() => {
            if (input.trim().length >= 2) {
              updateInput(input);
            }
          }}
          onBlur={dismiss}
          onCompositionStart={() => {
            composing.current = true;
            cancelRequests();
            setQuery(null);
            setOpen(false);
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            updateInput(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || composing.current) {
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              dismiss();
            } else if (
              open &&
              (event.key === 'ArrowDown' || event.key === 'ArrowUp')
            ) {
              event.preventDefault();
              setActiveIndex((index) =>
                event.key === 'ArrowDown'
                  ? (index + 1) % suggestions.length
                  : (index <= 0 ? suggestions.length : index) - 1,
              );
            } else if (open && event.key === 'Enter' && activeIndex >= 0) {
              event.preventDefault();
              void selectSuggestion(suggestions[activeIndex]);
            }
          }}
        />
        {open && (
          <ul
            className="google-place-suggestions"
            id={listId}
            role="listbox"
            aria-label={label}
            ref={listRef}
          >
            {suggestions.map((suggestion, index) => (
              <li
                id={`${listId}-${index}`}
                key={suggestion.placeId}
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void selectSuggestion(suggestion)}
              >
                <strong>{suggestion.text}</strong>
                {suggestion.secondaryText && (
                  <span>{suggestion.secondaryText}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span id={statusId} role="status">
        {status}
      </span>
      {error && (
        <span id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
