import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react';
import '../../styles/quick-search.css';

type Props = {
  open: boolean;
  shortcutLabel: string;
  onOpen: () => void;
  onClose: () => void;
};

type SearchMode = 'place' | 'schedule' | 'ai';
type SearchModeShortcutKey = '1' | '2' | '3';

type SearchModeDefinition = {
  id: SearchMode;
  shortcutKey: SearchModeShortcutKey;
  label: string;
  placeholder: string;
  resultsTitle: string;
  emptyMessage: string;
  path: string;
};

const SEARCH_MODES: readonly SearchModeDefinition[] = [
  {
    id: 'place',
    shortcutKey: '1',
    label: '장소 검색',
    placeholder: '장소를 검색하세요',
    resultsTitle: '장소 검색 결과',
    emptyMessage: '검색할 장소를 입력하세요.',
    path: 'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-5.5 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  },
  {
    id: 'schedule',
    shortcutKey: '2',
    label: '내 일정 검색',
    placeholder: '현재 여행의 일정과 장소를 검색하세요',
    resultsTitle: '일정 검색 결과',
    emptyMessage: '검색할 일정이나 장소를 입력하세요.',
    path: 'M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Zm3 8h3m2 0h3m-8 4h3m2 0h3',
  },
  {
    id: 'ai',
    shortcutKey: '3',
    label: 'AI에게 질문',
    placeholder: '여행 계획에 대해 질문하세요',
    resultsTitle: 'AI 응답',
    emptyMessage: '여행 계획에 대한 질문을 입력하세요.',
    path: 'M12 3.5c.45 3.52 2.48 5.55 6 6-3.52.45-5.55 2.48-6 6-.45-3.52-2.48-5.55-6-6 3.52-.45 5.55-2.48 6-6Zm6.5 11c.2 1.56 1.1 2.46 2.5 2.66-1.4.2-2.3 1.1-2.5 2.66-.2-1.56-1.1-2.46-2.5-2.66 1.4-.2 2.3-1.1 2.5-2.66Z',
  },
] as const;

function getSearchMode(mode: SearchMode): SearchModeDefinition {
  return SEARCH_MODES.find((candidate) => candidate.id === mode)!;
}

function getModeShortcutLabel(shortcutKey: SearchModeShortcutKey): string {
  return `Alt+${shortcutKey}`;
}

function getModeFromShortcut(event: KeyboardEvent): SearchMode | undefined {
  if (
    event.isComposing ||
    !event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return undefined;
  }
  return SEARCH_MODES.find((mode) => mode.shortcutKey === event.key)?.id;
}

function SearchModeIcon({ mode }: { mode: SearchModeDefinition }) {
  return (
    <span className={`quick-search-mode-icon is-${mode.id}`} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d={mode.path} />
      </svg>
    </span>
  );
}

export function getQuickSearchShortcutLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl K';
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
}

export function QuickSearch({ open, shortcutLabel, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('place');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modeControlRef = useRef<HTMLDivElement>(null);
  const modeOptionRefs = useRef(new Map<SearchMode, HTMLButtonElement>());
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const currentMode = getSearchMode(mode);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const close = useCallback(() => {
    setQuery('');
    setMode('place');
    setModeMenuOpen(false);
    setSubmitted(false);
    onClose();
  }, [onClose]);

  const selectMode = useCallback(
    (nextMode: SearchMode) => {
      setMode(nextMode);
      setModeMenuOpen(false);
      setSubmitted(false);
      focusInput();
    },
    [focusInput],
  );

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const quickSearchShortcut =
        event.key.toLocaleLowerCase() === 'k' &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey;
      if (quickSearchShortcut) {
        event.preventDefault();
        if (open) {
          setModeMenuOpen(false);
          inputRef.current?.focus();
        } else {
          onOpen();
        }
        return;
      }
      const shortcutMode = open ? getModeFromShortcut(event) : undefined;
      if (shortcutMode) {
        event.preventDefault();
        selectMode(shortcutMode);
        return;
      }
      if (open && event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [close, onOpen, open, selectMode]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const frame = requestAnimationFrame(() =>
      modeOptionRefs.current.get(mode)?.focus(),
    );
    const closeModeMenu = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !modeControlRef.current?.contains(event.target)
      ) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeModeMenu);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', closeModeMenu);
    };
  }, [mode, modeMenuOpen]);

  if (!open) return null;

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setSubmitted(true);
    }
  };
  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return (
    <div className="quick-search-overlay" onMouseDown={handleBackdropClick}>
      <section
        className="quick-search-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-search-title"
      >
        <h2 id="quick-search-title" className="sr-only">
          빠른 검색
        </h2>
        <div className="quick-search-input-row">
          <svg
            className="quick-search-search-icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5 5" />
          </svg>
          <div ref={modeControlRef} className="quick-search-mode-control">
            <button
              type="button"
              className="quick-search-mode-trigger"
              aria-label={`검색 모드: ${currentMode.label}`}
              aria-haspopup="menu"
              aria-expanded={modeMenuOpen}
              aria-controls="quick-search-mode-menu"
              onClick={() => setModeMenuOpen((current) => !current)}
            >
              <SearchModeIcon mode={currentMode} />
              <span>{currentMode.label}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m4 6 4 4 4-4" />
              </svg>
            </button>
            {modeMenuOpen && (
              <div
                id="quick-search-mode-menu"
                className="quick-search-mode-menu"
                role="menu"
                aria-label="검색 모드"
              >
                {SEARCH_MODES.map((item) => (
                  <button
                    key={item.id}
                    ref={(node) => {
                      if (node) modeOptionRefs.current.set(item.id, node);
                      else modeOptionRefs.current.delete(item.id);
                    }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={mode === item.id}
                    aria-keyshortcuts={getModeShortcutLabel(item.shortcutKey)}
                    onClick={() => selectMode(item.id)}
                  >
                    <SearchModeIcon mode={item} />
                    <span>{item.label}</span>
                    <kbd>{getModeShortcutLabel(item.shortcutKey)}</kbd>
                  </button>
                ))}
              </div>
            )}
          </div>
          <span className="quick-search-input-divider" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            role="searchbox"
            aria-label={`${currentMode.label} 입력`}
            aria-controls="quick-search-results"
            placeholder={currentMode.placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSubmitted(false);
            }}
            onFocus={() => setModeMenuOpen(false)}
            onKeyDown={handleInputKeyDown}
          />
          <kbd>{shortcutLabel}</kbd>
          <button
            type="button"
            className="quick-search-close"
            aria-label="빠른 검색 닫기"
            title="닫기"
            onClick={close}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="quick-search-body">
          <section
            id="quick-search-results"
            className="quick-search-results"
            aria-label={currentMode.resultsTitle}
          >
            <h3>{currentMode.resultsTitle}</h3>
            <div role="status">
              {submitted
                ? `${currentMode.label} 기능은 아직 연결되지 않았습니다.`
                : query.trim()
                  ? `${currentMode.resultsTitle}가 여기에 표시됩니다.`
                  : currentMode.emptyMessage}
            </div>
          </section>
        </div>

        <footer className="quick-search-footer" aria-hidden="true">
          <span>
            {SEARCH_MODES.map((item) => (
              <kbd key={item.id}>{getModeShortcutLabel(item.shortcutKey)}</kbd>
            ))}{' '}
            모드 전환
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 이동
          </span>
          <span>
            <kbd>Enter</kbd> 선택
          </span>
          <span>
            <kbd>Esc</kbd> 닫기
          </span>
        </footer>
      </section>
    </div>
  );
}
