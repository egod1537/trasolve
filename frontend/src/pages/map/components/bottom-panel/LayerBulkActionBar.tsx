import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { TripPolyline, TripPolylineMode } from '@trasolve/shared';
import { formatPolylineMode } from '../../domain/polylineMode';
import { PolylineModeIcon } from '../PolylineModeIcon';
import { PolylineModeOptions } from '../PolylineModeOptions';
import '../../styles/bottom-context-panel.css';

type Props = {
  selectedPlaceIds: readonly string[];
  selectedPolylines: readonly TripPolyline[];
  busy: boolean;
  mutationError: string | null;
  onUpdatePolylineModes: (
    ids: readonly string[],
    mode: TripPolylineMode,
  ) => Promise<boolean>;
  onDeletePlaces: (ids: readonly string[]) => Promise<boolean>;
  onClearSelection: () => void;
};

type BulkOperation = 'mode' | 'delete' | null;

export function LayerBulkActionBar({
  selectedPlaceIds,
  selectedPolylines,
  busy,
  mutationError,
  onUpdatePolylineModes,
  onDeletePlaces,
  onClearSelection,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const modeTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteCancelRef = useRef<HTMLButtonElement>(null);
  const modePopupId = useId();
  const deletePopupId = useId();
  const deleteTitleId = useId();
  const deleteDescriptionId = useId();
  const [modeOpen, setModeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [operation, setOperation] = useState<BulkOperation>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const disabled = busy || operation !== null;
  const selectedPolylineIds = useMemo(
    () => selectedPolylines.map((polyline) => polyline.id),
    [selectedPolylines],
  );
  const commonMode = useMemo<TripPolylineMode | null>(() => {
    const modes = new Set(selectedPolylines.map((polyline) => polyline.mode));
    return modes.size === 1 ? (modes.values().next().value ?? null) : null;
  }, [selectedPolylines]);
  const totalCount = selectedPlaceIds.length + selectedPolylines.length;

  useLayoutEffect(() => {
    if (deleteOpen) {
      deleteCancelRef.current?.focus();
    }
  }, [deleteOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setModeOpen(false);
        setDeleteOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || operation) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (deleteOpen) {
        setDeleteOpen(false);
        requestAnimationFrame(() => deleteTriggerRef.current?.focus());
      } else if (modeOpen) {
        setModeOpen(false);
        requestAnimationFrame(() => modeTriggerRef.current?.focus());
      } else {
        onClearSelection();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [deleteOpen, modeOpen, onClearSelection, operation]);

  const updateModes = async (mode: TripPolylineMode) => {
    if (disabled || !selectedPolylineIds.length) {
      return;
    }
    if (commonMode === mode) {
      setModeOpen(false);
      requestAnimationFrame(() => modeTriggerRef.current?.focus());
      return;
    }
    setOperation('mode');
    setActionError(null);
    try {
      if (await onUpdatePolylineModes(selectedPolylineIds, mode)) {
        setModeOpen(false);
        requestAnimationFrame(() => modeTriggerRef.current?.focus());
      } else {
        setActionError('이동수단을 변경하지 못했습니다.');
      }
    } finally {
      setOperation(null);
    }
  };

  const deletePlaces = async () => {
    if (disabled || !selectedPlaceIds.length) {
      return;
    }
    setOperation('delete');
    setActionError(null);
    try {
      if (!(await onDeletePlaces(selectedPlaceIds))) {
        setActionError('선택한 장소를 삭제하지 못했습니다.');
      }
    } finally {
      setOperation(null);
    }
  };

  return (
    <div
      ref={rootRef}
      className="layer-bulk-action-bar"
      role="toolbar"
      aria-label="선택 항목 일괄 작업"
      aria-busy={operation !== null}
    >
      <span className="layer-bulk-selection-count">
        <strong>{totalCount}개 선택됨</strong>
        {!!selectedPolylines.length && (
          <span>· 경로 {selectedPolylines.length}개</span>
        )}
      </span>
      {mutationError && (
        <span
          className="layer-bulk-status-error"
          role="alert"
          title={mutationError}
        >
          작업 실패
        </span>
      )}

      <span className="layer-bulk-actions">
        {!!selectedPolylines.length && (
          <span className="layer-bulk-action-anchor">
            <button
              ref={modeTriggerRef}
              type="button"
              className="layer-bulk-mode-trigger"
              aria-label="선택한 경로 이동수단 변경"
              aria-haspopup="dialog"
              aria-expanded={modeOpen}
              aria-controls={modeOpen ? modePopupId : undefined}
              disabled={disabled}
              onClick={() => {
                setDeleteOpen(false);
                setActionError(null);
                setModeOpen((open) => !open);
              }}
            >
              {commonMode && <PolylineModeIcon mode={commonMode} />}
              <span>
                {commonMode
                  ? formatPolylineMode(commonMode)
                  : '이동수단 · 혼합'}
              </span>
              <svg
                className="layer-bulk-chevron"
                viewBox="0 0 16 16"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
            </button>
            {modeOpen && (
              <div
                id={modePopupId}
                className="layer-bulk-mode-popover"
                role="dialog"
                aria-label="이동수단 일괄 변경"
              >
                <strong>이동수단</strong>
                <PolylineModeOptions
                  mode={commonMode}
                  busy={disabled}
                  showLabels
                  onSelect={(mode) => void updateModes(mode)}
                />
                {actionError && <p role="alert">{actionError}</p>}
              </div>
            )}
          </span>
        )}

        {!!selectedPlaceIds.length && (
          <span className="layer-bulk-action-anchor">
            <button
              ref={deleteTriggerRef}
              type="button"
              className="layer-bulk-delete-trigger"
              aria-label={`선택한 장소 ${selectedPlaceIds.length}개 삭제`}
              aria-haspopup="dialog"
              aria-expanded={deleteOpen}
              aria-controls={deleteOpen ? deletePopupId : undefined}
              disabled={disabled}
              onClick={() => {
                setModeOpen(false);
                setActionError(null);
                setDeleteOpen(true);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
              </svg>
              <span>삭제</span>
            </button>
            {deleteOpen && (
              <section
                id={deletePopupId}
                className="layer-bulk-delete-popover"
                role="alertdialog"
                aria-labelledby={deleteTitleId}
                aria-describedby={deleteDescriptionId}
              >
                <div>
                  <strong id={deleteTitleId}>
                    선택한 장소 {selectedPlaceIds.length}개를 삭제하시겠습니까?
                  </strong>
                  <p id={deleteDescriptionId}>
                    연결 경로는 장소 순서에 맞춰 자동으로 다시 구성됩니다.
                  </p>
                </div>
                {actionError && (
                  <p className="layer-bulk-error" role="alert">
                    {actionError}
                  </p>
                )}
                <div className="layer-bulk-delete-actions">
                  <button
                    ref={deleteCancelRef}
                    type="button"
                    disabled={operation === 'delete'}
                    onClick={() => {
                      setDeleteOpen(false);
                      requestAnimationFrame(() =>
                        deleteTriggerRef.current?.focus(),
                      );
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="is-destructive"
                    aria-busy={operation === 'delete'}
                    disabled={disabled}
                    onClick={() => void deletePlaces()}
                  >
                    {operation === 'delete' ? '삭제 중…' : '삭제'}
                  </button>
                </div>
              </section>
            )}
          </span>
        )}
      </span>
    </div>
  );
}
