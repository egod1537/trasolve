import { Button, Classes, NonIdealState } from '@blueprintjs/core';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { DragHandle } from '@/shared/ui/DragHandle';
import {
  MIN_VISIT_DURATION_MINUTES,
  VISIT_TIME_GRANULARITY_MINUTES,
} from '@/entities/place';
import type {
  JobBuilderLocation,
  JobBuilderLocationErrors,
  JobBuilderLocationRole,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import {
  getJobBuilderLocationRole,
  MAX_STAY_MINUTES,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { JobBuilderValidationIndicator } from '@/features/troute-testbed/job-builder/JobBuilderValidationIndicator';
import type { JobBuilderValidationStatus } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';

interface JobBuilderLocationListProps {
  locations: JobBuilderLocation[];
  selectedLocationId: string | null;
  errors: Record<string, JobBuilderLocationErrors>;
  validationStatus: JobBuilderValidationStatus;
  validationErrorCount: number;
  onSelect: (locationId: string) => void;
  onUpdate: (locationId: string, patch: JobBuilderLocationPatch) => void;
  onRemove: (locationId: string) => void;
  onReorder: (locationId: string, targetIndex: number) => void;
}

type JobBuilderLocationPatch = Partial<
  Pick<JobBuilderLocation, 'openTime' | 'closeTime' | 'stayMinutes'>
>;

interface DragState {
  locationId: string;
  pointerId: number;
  targetIndex: number;
}

interface LocationItemDragProps {
  dragging: boolean;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

type DropTargetEdge = 'before' | 'after' | null;

interface DropTarget {
  locationId: string;
  edge: Exclude<DropTargetEdge, null>;
}

const ROLE_LABELS: Record<JobBuilderLocationRole, string> = {
  start: '출발지',
  waypoint: '경유지',
  end: '도착지',
};

export function JobBuilderLocationList({
  locations,
  selectedLocationId,
  errors,
  validationStatus,
  validationErrorCount,
  onSelect,
  onUpdate,
  onRemove,
  onReorder,
}: JobBuilderLocationListProps) {
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
    if (!event.isPrimary || event.button !== 0) {
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
    const targetIndex = beforeIndex < 0 ? locations.length - 1 : beforeIndex;
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
    if (!direction || targetIndex < 0 || targetIndex >= locations.length) {
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
        key={location.id}
        location={location}
        index={index}
        role={role}
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
          <h2 className={Classes.HEADING}>위치 목록</h2>
          <p>
            모든 위치의 순서를 변경할 수 있습니다. 첫 위치는 출발지, 마지막
            위치는 도착지이며 나머지는 경유지입니다. Google 영업시간이 있으면
            자동으로 입력되며 직접 편집할 때는 {VISIT_TIME_GRANULARITY_MINUTES}
            분 단위입니다.
          </p>
        </div>
        <div className="job-builder-location-meta">
          <span className="job-builder-location-count">
            {locations.length}개
          </span>
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
            title="추가된 장소가 없습니다."
            description="출발지와 도착지를 포함해 장소가 2개 이상 필요합니다."
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

function getDropTarget(
  locations: readonly JobBuilderLocation[],
  dragState: DragState | null,
): DropTarget | null {
  if (!dragState) {
    return null;
  }
  const remainingLocations = locations.filter(
    (location) => location.id !== dragState.locationId,
  );
  const targetLocation =
    dragState.targetIndex >= remainingLocations.length
      ? remainingLocations.at(-1)
      : remainingLocations[dragState.targetIndex];
  if (!targetLocation) {
    return null;
  }
  return {
    locationId: targetLocation.id,
    edge:
      dragState.targetIndex >= remainingLocations.length ? 'after' : 'before',
  };
}

interface JobBuilderLocationItemProps {
  location: JobBuilderLocation;
  index: number;
  role: JobBuilderLocationRole;
  selected: boolean;
  dropTargetEdge: DropTargetEdge;
  errors: JobBuilderLocationErrors;
  drag: LocationItemDragProps;
  setRowRef: (element: HTMLElement | null) => void;
  onSelect: () => void;
  onUpdate: (patch: JobBuilderLocationPatch) => void;
  onRemove: () => void;
}

function JobBuilderLocationItem({
  location,
  index,
  role,
  selected,
  dropTargetEdge,
  errors,
  drag,
  setRowRef,
  onSelect,
  onUpdate,
  onRemove,
}: JobBuilderLocationItemProps) {
  return (
    <article
      ref={setRowRef}
      className={`job-builder-location-item${selected ? ' is-selected' : ''}${drag.dragging ? ' is-dragging' : ''}${dropTargetEdge ? ` is-drop-target-${dropTargetEdge}` : ''}`}
      data-builder-location-id={location.id}
      data-builder-sortable-location-id={location.id}
      onClick={onSelect}
    >
      <div className="job-builder-location-heading">
        <DragHandle
          className="job-builder-drag-handle"
          label={`${location.name} 위치`}
          dragging={drag.dragging}
          onPointerDown={drag.onPointerDown}
          onPointerMove={drag.onPointerMove}
          onPointerUp={drag.onPointerUp}
          onPointerCancel={drag.onPointerCancel}
          onLostPointerCapture={drag.onLostPointerCapture}
          onKeyDown={drag.onKeyDown}
        />
        <span className="job-builder-location-order">{index + 1}</span>
        <div className="job-builder-location-copy">
          <span className="job-builder-location-name">
            <strong>{location.name}</strong>
            <span className={`job-builder-location-role is-${role}`}>
              {ROLE_LABELS[role]}
            </span>
          </span>
          <span className="job-builder-location-address">
            {location.address ?? '주소 정보 없음'}
          </span>
        </div>
        <Button
          aria-label={`${location.name} 제거`}
          title="제거"
          icon="cross"
          size="small"
          variant="minimal"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        />
      </div>

      <div
        className="job-builder-location-fields"
        onClick={(event) => event.stopPropagation()}
      >
        <label>
          <span>영업 시간</span>
          <span className="job-builder-time-range">
            <input
              className="bp6-input"
              type="time"
              step={VISIT_TIME_GRANULARITY_MINUTES * 60}
              aria-label={`${location.name} 영업 시작 시각`}
              aria-invalid={Boolean(errors.openTime)}
              value={location.openTime}
              onChange={(event) => onUpdate({ openTime: event.target.value })}
            />
            <span>~</span>
            <input
              className="bp6-input"
              type="time"
              step={VISIT_TIME_GRANULARITY_MINUTES * 60}
              aria-label={`${location.name} 영업 종료 시각`}
              aria-invalid={Boolean(errors.closeTime)}
              value={location.closeTime}
              onChange={(event) => onUpdate({ closeTime: event.target.value })}
            />
          </span>
        </label>
        {errors.openTime || errors.closeTime ? (
          <p className="job-builder-field-error" role="alert">
            {errors.openTime ?? errors.closeTime}
          </p>
        ) : null}
        <label>
          <span>체류 시간</span>
          <span className="job-builder-stay-input">
            <input
              className="bp6-input"
              type="number"
              min={role === 'waypoint' ? MIN_VISIT_DURATION_MINUTES : 0}
              max={MAX_STAY_MINUTES}
              step={VISIT_TIME_GRANULARITY_MINUTES}
              aria-label={`${location.name} 체류 시간(분)`}
              aria-invalid={Boolean(errors.stayMinutes)}
              value={location.stayMinutes}
              onChange={(event) =>
                onUpdate({ stayMinutes: Number(event.target.value) })
              }
            />
            <span>분</span>
          </span>
        </label>
        {errors.stayMinutes ? (
          <p className="job-builder-field-error" role="alert">
            {errors.stayMinutes}
          </p>
        ) : null}
      </div>
    </article>
  );
}
