import { Button, Classes, NonIdealState } from '@blueprintjs/core';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { VISIT_TIME_GRANULARITY_MINUTES } from '@/entities/place';
import type { JobBuilderLocation } from '@/features/troute-testbed/job-builder/jobBuilderModel';
import {
  canShuffleJobBuilderLocations,
  getJobBuilderLocationRole,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { JobBuilderValidationIndicator } from '@/features/troute-testbed/job-builder/JobBuilderValidationIndicator';
import { useL } from '@/shared/i18n';
import { type JobBuilderLocationListProps } from '@/features/troute-testbed/job-builder/jobBuilderLocationTypes';
import {
  type DragState,
  type LocationItemDragProps,
  getDropTarget,
} from '@/features/troute-testbed/job-builder/jobBuilderDrag';
import { JobBuilderLocationItem } from '@/features/troute-testbed/job-builder/JobBuilderLocationItem';

export function JobBuilderLocationList({
  locations,
  placeIdRequired,
  selectedLocationId,
  errors,
  validationStatus,
  validationErrorCount,
  onSelect,
  onUpdate,
  onRemove,
  onReorder,
  onShuffle,
}: JobBuilderLocationListProps) {
  const L = useL();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sortableListRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pointerYRef = useRef(0);
  const frameRef = useRef(0);
  const dropTarget = getDropTarget(locations, dragState);
  useEffect(() => {
    if (selectedLocationId) {
      rowRefs.current
        .get(selectedLocationId)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedLocationId]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  function updateDragState(next: DragState | null): void {
    dragStateRef.current = next;
    setDragState(next);
  }

  function startDrag(
    locationId: string,
    sourceIndex: number,
    event: PointerEvent<HTMLButtonElement>,
  ): void {
    if (
      sourceIndex <= 0 ||
      sourceIndex >= locations.length - 1 ||
      !event.isPrimary ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerYRef.current = event.clientY;
    updateDragState({
      locationId,
      pointerId: event.pointerId,
      targetIndex: sourceIndex,
    });
  }

  function updateDragTarget(pointerY: number): void {
    const current = dragStateRef.current;
    if (!current) {
      return;
    }
    const rows = Array.from(
      sortableListRef.current?.querySelectorAll<HTMLElement>(
        '[data-builder-sortable-location-id]',
      ) ?? [],
    ).filter(
      (row) => row.dataset.builderSortableLocationId !== current.locationId,
    );
    const beforeIndex = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return pointerY < rect.top + rect.height / 2;
    });
    const targetIndex =
      beforeIndex < 0 ? locations.length - 2 : beforeIndex + 1;
    const list = scrollRef.current;
    if (list) {
      const rect = list.getBoundingClientRect();
      if (pointerY < rect.top + 48) {
        list.scrollTop -= 10;
      } else if (pointerY > rect.bottom - 48) {
        list.scrollTop += 10;
      }
    }
    if (targetIndex !== current.targetIndex) {
      updateDragState({ ...current, targetIndex });
    }
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>): void {
    const current = dragStateRef.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    pointerYRef.current = event.clientY;
    if (frameRef.current) {
      return;
    }
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      updateDragTarget(pointerYRef.current);
    });
  }

  function finishDrag(
    event: PointerEvent<HTMLButtonElement>,
    commit: boolean,
  ): void {
    let current = dragStateRef.current;
    if (!current || current.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    updateDragTarget(event.clientY);
    current = dragStateRef.current;
    if (!current) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateDragState(null);
    if (commit) {
      onReorder(current.locationId, current.targetIndex);
    }
  }

  function reorderWithKeyboard(
    locationId: string,
    sourceIndex: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ): void {
    if (!event.altKey) {
      return;
    }
    const direction =
      event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    const targetIndex = sourceIndex + direction;
    if (
      !direction ||
      sourceIndex <= 0 ||
      sourceIndex >= locations.length - 1 ||
      targetIndex <= 0 ||
      targetIndex >= locations.length - 1
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onReorder(locationId, targetIndex);
  }

  function renderLocation(location: JobBuilderLocation, index: number) {
    const role = getJobBuilderLocationRole(index, locations.length);
    const drag: LocationItemDragProps = {
      dragging: dragState?.locationId === location.id,
      onPointerDown: (event) => startDrag(location.id, index, event),
      onPointerMove: moveDrag,
      onPointerUp: (event) => finishDrag(event, true),
      onPointerCancel: (event) => finishDrag(event, false),
      onLostPointerCapture: (event) => {
        if (dragStateRef.current?.pointerId === event.pointerId) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = 0;
          updateDragState(null);
        }
      },
      onKeyDown: (event) => reorderWithKeyboard(location.id, index, event),
    };
    const dropTargetEdge =
      dropTarget?.locationId === location.id ? dropTarget.edge : null;

    return (
      <JobBuilderLocationItem
        key={`${index}:${location.id}`}
        location={location}
        index={index}
        role={role}
        placeIdRequired={placeIdRequired}
        selected={selectedLocationId === location.id}
        dropTargetEdge={dropTargetEdge}
        errors={errors[location.id] ?? {}}
        drag={drag}
        setRowRef={(element) => {
          if (element) {
            rowRefs.current.set(location.id, element);
          } else {
            rowRefs.current.delete(location.id);
          }
        }}
        onSelect={() => onSelect(location.id)}
        onUpdate={(patch) => onUpdate(location.id, patch)}
        onRemove={() => onRemove(location.id)}
      />
    );
  }

  return (
    <aside className="job-builder-location-panel">
      <header>
        <div>
          <h2 className={Classes.HEADING}>
            {L('testbed:tcacheLocationList.title.locationList')}
          </h2>
          <p>
            {L(
              'testbed:jobBuilderLocationList.text.firstPositionFixedStartLastPosition',
              {
                value: ' ',
                VISIT_TIME_GRANULARITY_MINUTES: VISIT_TIME_GRANULARITY_MINUTES,
              },
            )}
          </p>
        </div>
        <div className="job-builder-location-meta">
          <span className="job-builder-location-count">
            {L('testbed:jobBuilderLocationList.text.message', {
              length: locations.length,
            })}
          </span>
          <Button
            icon="random"
            size="small"
            variant="minimal"
            disabled={!canShuffleJobBuilderLocations(locations)}
            aria-label={L(
              'testbed:jobBuilderLocationList.ariaLabel.shuffleIntermediatePositions',
            )}
            title={L(
              'testbed:jobBuilderLocationList.ariaLabel.shuffleIntermediatePositions',
            )}
            onClick={onShuffle}
          >
            {L('testbed:jobBuilderLocationList.action.middleOrderShuffle')}
          </Button>
          <JobBuilderValidationIndicator
            status={validationStatus}
            errorCount={validationErrorCount}
          />
        </div>
      </header>

      <div ref={scrollRef} className="job-builder-location-scroll">
        {locations.length === 0 ? (
          <NonIdealState
            className="job-builder-location-empty"
            icon="map-marker"
            title={L(
              'testbed:jobBuilderLocationList.tooltip.noLocationsHaveBeenAdded',
            )}
            description={L(
              'testbed:jobBuilderLocationList.text.youNeedAtLeastTwoLocations',
            )}
          />
        ) : (
          <div ref={sortableListRef} className="job-builder-location-list">
            {locations.map(renderLocation)}
          </div>
        )}
      </div>
    </aside>
  );
}
