import { useEffect, useId, useRef, useState } from 'react';
import type { RouteOptimizationRequest, TripDay } from '@trasolve/shared';
import { createRouteOptimizationRequest } from '@/features/route-optimization/model/routeOptimization';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';

type DebugCopyStatus = 'idle' | 'copied' | 'failed';

type Props = {
  id: string;
  activeDay: TripDay;
  onClose: () => void;
  onOptimize?: (request: RouteOptimizationRequest) => Promise<void> | void;
};

export function RouteOptimizationModal({
  id,
  activeDay,
  onClose,
  onOptimize,
}: Props) {
  const [includeStayDuration, setIncludeStayDuration] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugCopyStatus, setDebugCopyStatus] =
    useState<DebugCopyStatus>('idle');
  const firstControlRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const optionDescriptionId = useId();
  const placeCount = activeDay.places.length;
  const canOptimize = placeCount >= 2 && onOptimize !== undefined;

  useEffect(() => {
    if (debugCopyStatus === 'idle') {
      return;
    }
    const timeout = window.setTimeout(() => setDebugCopyStatus('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [debugCopyStatus]);

  useEffect(() => {
    const interceptGlobalKeyDown = (event: KeyboardEvent) => {
      const isQuickSearchShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === 'k';
      const isSearchModeShortcut =
        event.altKey && ['1', '2', '3'].includes(event.key);
      if (!isQuickSearchShortcut && !isSearchModeShortcut) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener('keydown', interceptGlobalKeyDown, true);
    return () =>
      window.removeEventListener('keydown', interceptGlobalKeyDown, true);
  }, []);

  const copyDebugPayload = async () => {
    try {
      const payload = createRouteOptimizationRequest(activeDay, {
        includeStayDuration,
      });
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setDebugCopyStatus('copied');
    } catch {
      setDebugCopyStatus('failed');
    }
  };

  const runOptimization = async () => {
    if (!canOptimize || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const request = createRouteOptimizationRequest(activeDay, {
        includeStayDuration,
      });
      await onOptimize(request);
      onClose();
    } catch {
      setError('경로 최적화 요청에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      id={id}
      className="route-optimization-modal"
      backdropClassName="route-optimization-modal-backdrop"
      labelledBy={titleId}
      describedBy={descriptionId}
      busy={submitting}
      closeOnBackdrop={!submitting}
      closeOnEscape={!submitting}
      initialFocusRef={firstControlRef}
      onClose={onClose}
    >
      <header className="route-optimization-modal-header">
        <div>
          <h2 id={titleId}>경로 최적화</h2>
          <p id={descriptionId}>현재 Day의 장소 방문 순서를 최적화합니다.</p>
          <strong>
            {activeDay.title} · {placeCount}개 장소
          </strong>
        </div>
        <IconButton
          className="route-optimization-modal-close"
          aria-label="경로 최적화 닫기"
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={onClose}
        />
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
          {import.meta.env.DEV && (
            <Button
              disabled={submitting}
              onClick={() => void copyDebugPayload()}
            >
              <span aria-live="polite">
                {debugCopyStatus === 'copied'
                  ? '복사됨'
                  : debugCopyStatus === 'failed'
                    ? '복사 실패'
                    : '디버그 복사'}
              </span>
            </Button>
          )}
          <Button disabled={submitting} onClick={onClose}>
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!canOptimize || submitting}
          >
            {submitting ? '최적화 중…' : '최적화 실행'}
          </Button>
        </footer>
      </form>
    </Dialog>
  );
}
