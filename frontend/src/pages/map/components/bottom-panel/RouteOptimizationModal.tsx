import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
} from 'react';
import type { TripDay } from '@trasolve/shared';

export type RouteOptimizationOptions = {
  dayId: string;
  includeStayDuration: boolean;
};

type Props = {
  id: string;
  activeDay: TripDay;
  onClose: () => void;
  onOptimize?: (options: RouteOptimizationOptions) => Promise<void> | void;
};

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function RouteOptimizationModal({
  id,
  activeDay,
  onClose,
  onOptimize,
}: Props) {
  const [includeStayDuration, setIncludeStayDuration] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const firstControlRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const optionDescriptionId = useId();
  const placeCount = activeDay.places.length;
  const canOptimize = placeCount >= 2 && onOptimize !== undefined;

  useLayoutEffect(() => {
    firstControlRef.current?.focus();
  }, []);

  useEffect(() => {
    const interceptGlobalKeyDown = (event: KeyboardEvent) => {
      const isQuickSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === 'k';
      const isSearchModeShortcut =
        event.altKey && ['1', '2', '3'].includes(event.key);
      if (
        event.key !== 'Escape' &&
        !isQuickSearchShortcut &&
        !isSearchModeShortcut
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', interceptGlobalKeyDown, true);
    return () =>
      window.removeEventListener('keydown', interceptGlobalKeyDown, true);
  }, [onClose, submitting]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    event.stopPropagation();

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    );
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !submitting) onClose();
  };

  const runOptimization = async () => {
    if (!canOptimize || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onOptimize({
        dayId: activeDay.id,
        includeStayDuration,
      });
      onClose();
    } catch {
      setError('경로 최적화 요청에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="route-optimization-modal-backdrop"
      onClick={closeFromBackdrop}
    >
      <section
        ref={dialogRef}
        id={id}
        className="route-optimization-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={submitting}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="route-optimization-modal-header">
          <div>
            <h2 id={titleId}>경로 최적화</h2>
            <p id={descriptionId}>현재 Day의 장소 방문 순서를 최적화합니다.</p>
            <strong>
              {activeDay.title} · {placeCount}개 장소
            </strong>
          </div>
          <button
            type="button"
            className="route-optimization-modal-close"
            aria-label="경로 최적화 닫기"
            disabled={submitting}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <form
          className="route-optimization-modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            void runOptimization();
          }}
        >
          <label className="route-optimization-stay-duration-option">
            <span>
              <strong>체류시간 포함</strong>
              <small id={optionDescriptionId}>
                장소별 체류시간을 최적화 조건에 포함합니다.
              </small>
            </span>
            <input
              ref={firstControlRef}
              type="checkbox"
              checked={includeStayDuration}
              disabled={submitting}
              aria-describedby={optionDescriptionId}
              onChange={(event) => setIncludeStayDuration(event.target.checked)}
            />
          </label>

          {placeCount < 2 ? (
            <p className="route-optimization-modal-notice" role="status">
              경로 최적화에는 2개 이상의 장소가 필요합니다.
            </p>
          ) : !onOptimize ? (
            <p className="route-optimization-modal-notice" role="status">
              최적화 실행 기능을 준비하고 있습니다.
            </p>
          ) : null}
          {error && (
            <p className="route-optimization-modal-error" role="alert">
              {error}
            </p>
          )}

          <footer className="route-optimization-modal-actions">
            <button type="button" disabled={submitting} onClick={onClose}>
              취소
            </button>
            <button
              type="submit"
              className="is-primary"
              disabled={!canOptimize || submitting}
            >
              {submitting ? '최적화 중…' : '최적화 실행'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
