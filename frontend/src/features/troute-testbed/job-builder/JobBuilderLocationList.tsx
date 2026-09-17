import { Button, Classes, NonIdealState } from '@blueprintjs/core';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { DragHandle } from '@/shared/ui/DragHandle';
import {
  MIN_VISIT_DURATION_MINUTES,
  VISIT_TIME_GRANULARITY_MINUTES,
} from '@/entities/place';
import type {
  JobBuilderLocation,
  JobBuilderLocationErrors,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { MAX_STAY_MINUTES } from '@/features/troute-testbed/job-builder/jobBuilderModel';

interface JobBuilderLocationListProps {
  locations: JobBuilderLocation[];
  selectedLocationId: string | null;
  errors: Record<string, JobBuilderLocationErrors>;
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

export function JobBuilderLocationList({
  locations,
  selectedLocationId,
  errors,
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
  const start = locations[0];
  const destination = locations.length >= 2 ? locations.at(-1) : undefined;
  const intermediates = locations.slice(1, -1);

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
    const targetIndex =
      (beforeIndex < 0 ? intermediates.length - 1 : beforeIndex) + 1;
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
    if (!direction || targetIndex <= 0 || targetIndex >= locations.length - 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onReorder(locationId, targetIndex);
  }

  function renderLocation(
    location: JobBuilderLocation,
    index: number,
    endpointRole?: 'start' | 'destination',
  ) {
    const drag: LocationItemDragProps | undefined = endpointRole
      ? undefined
      : {
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

    return (
      <JobBuilderLocationItem
        key={location.id}
        location={location}
        index={index}
        endpointRole={endpointRole}
        selected={selectedLocationId === location.id}
        dropTarget={dragState?.targetIndex === index}
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
            첫 위치는 출발지, 마지막 위치는 도착지입니다. 중간 방문지만 순서를
            변경할 수 있습니다. Google 영업시간이 있으면 자동으로 입력되며 직접
            편집할 때는 {VISIT_TIME_GRANULARITY_MINUTES}분 단위입니다.
          </p>
        </div>
        <span className="job-builder-location-count">{locations.length}개</span>
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
          <>
            <LocationGroup title="출발">
              {start ? renderLocation(start, 0, 'start') : null}
            </LocationGroup>

            <LocationGroup title="중간 방문지">
              {intermediates.length ? (
                <div
                  ref={sortableListRef}
                  className="job-builder-intermediate-list"
                >
                  {intermediates.map((location, middleIndex) =>
                    renderLocation(location, middleIndex + 1),
                  )}
                </div>
              ) : (
                <p className="job-builder-location-group-empty">
                  추가 장소는 도착지 앞에 삽입됩니다.
                </p>
              )}
            </LocationGroup>

            <LocationGroup title="도착">
              {destination ? (
                renderLocation(destination, locations.length - 1, 'destination')
              ) : (
                <p className="job-builder-endpoint-placeholder">
                  도착지를 추가하세요. 출발지와 도착지를 포함해 장소가 2개 이상
                  필요합니다.
                </p>
              )}
            </LocationGroup>
          </>
        )}
      </div>
    </aside>
  );
}

function LocationGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="job-builder-location-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

interface JobBuilderLocationItemProps {
  location: JobBuilderLocation;
  index: number;
  endpointRole?: 'start' | 'destination';
  selected: boolean;
  dropTarget: boolean;
  errors: JobBuilderLocationErrors;
  drag?: LocationItemDragProps;
  setRowRef: (element: HTMLElement | null) => void;
  onSelect: () => void;
  onUpdate: (patch: JobBuilderLocationPatch) => void;
  onRemove: () => void;
}

function JobBuilderLocationItem({
  location,
  index,
  endpointRole,
  selected,
  dropTarget,
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
      className={`job-builder-location-item${selected ? ' is-selected' : ''}${drag?.dragging ? ' is-dragging' : ''}${dropTarget ? ' is-drop-target' : ''}`}
      data-builder-location-id={location.id}
      data-builder-sortable-location-id={drag ? location.id : undefined}
      onClick={onSelect}
    >
      <div className="job-builder-location-heading">
        {drag ? (
          <DragHandle
            className="job-builder-drag-handle"
            label={location.name}
            dragging={drag.dragging}
            onPointerDown={drag.onPointerDown}
            onPointerMove={drag.onPointerMove}
            onPointerUp={drag.onPointerUp}
            onPointerCancel={drag.onPointerCancel}
            onLostPointerCapture={drag.onLostPointerCapture}
            onKeyDown={drag.onKeyDown}
          />
        ) : (
          <span
            className={`job-builder-endpoint-badge is-${endpointRole}`}
            aria-hidden="true"
          >
            {endpointRole === 'start' ? '출' : '도'}
          </span>
        )}
        <span className="job-builder-location-order">{index + 1}</span>
        <div>
          <strong>{location.name}</strong>
          <span>{location.address ?? '주소 정보 없음'}</span>
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
              min={MIN_VISIT_DURATION_MINUTES}
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
