import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { TripPolyline, TripPolylineMode } from '@trasolve/shared';
import { formatPolylineMode } from '@/features/map-workspace/lib/mapFormatters';
import { PolylineModeIcon } from '@/features/map-workspace/components/PolylineModeIcon';
import { PolylineModeOptions } from '@/features/map-workspace/components/PolylineModeOptions';
import '@/features/map-workspace/styles/bottom-context-panel.css';
import { useL } from '@/shared/i18n';

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
  const L = useL();
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
        setActionError(
          L('map:layerBulkActionBar.text.failedChangeModeTransportation'),
        );
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
        setActionError(
          L('map:layerBulkActionBar.text.failedDeleteSelectedLocation'),
        );
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
      aria-label={L(
        'map:layerBulkActionBar.ariaLabel.batchOperationsSelections',
      )}
      aria-busy={operation !== null}
    >
      <span className="layer-bulk-selection-count">
        <strong>
          {L('map:layerBulkActionBar.text.selected', {
            totalCount: totalCount,
          })}
        </strong>
        {!!selectedPolylines.length && (
          <span>
            {L('map:layerBulkActionBar.text.paths', {
              length: selectedPolylines.length,
            })}
          </span>
        )}
      </span>
      {mutationError && (
        <span
          className="layer-bulk-status-error"
          role="alert"
          title={mutationError}
        >
          {L('map:layerBulkActionBar.text.taskFailed')}
        </span>
      )}

      <span className="layer-bulk-actions">
        {!!selectedPolylines.length && (
          <span className="layer-bulk-action-anchor">
            <button
              ref={modeTriggerRef}
              type="button"
              className="layer-bulk-mode-trigger"
              aria-label={L(
                'map:layerBulkActionBar.ariaLabel.changeSelectedRouteTransportationMethod',
              )}
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
                  ? formatPolylineMode(commonMode, L)
                  : L('map:layerBulkActionBar.text.transportationMixed')}
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
                aria-label={L(
                  'map:layerBulkActionBar.ariaLabel.bulkChangeMeansTransportation',
                )}
              >
                <strong>
                  {L('map:layerBulkActionBar.text.meansTransportation')}
                </strong>
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
              aria-label={L(
                'map:layerBulkActionBar.ariaLabel.deleteSelectedLocations',
                { length: selectedPlaceIds.length },
              )}
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
              <span>{L('common:action.delete')}</span>
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
                    {L(
                      'map:layerBulkActionBar.text.youSureYouWantDeleteSelected',
                      { length: selectedPlaceIds.length },
                    )}
                  </strong>
                  <p id={deleteDescriptionId}>
                    {L(
                      'map:layerBulkActionBar.description.connectionRoutesAutomaticallyReorganizedMatchOrder',
                    )}
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
                    {L('common:action.cancel')}
                  </button>
                  <button
                    type="button"
                    className="is-destructive"
                    aria-busy={operation === 'delete'}
                    disabled={disabled}
                    onClick={() => void deletePlaces()}
                  >
                    {operation === 'delete'
                      ? L('map:layerBulkActionBar.action.deleting')
                      : L('common:action.delete')}
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
