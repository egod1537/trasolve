import {
  Button,
  Classes,
  InputGroup,
  NonIdealState,
  Tag,
} from '@blueprintjs/core';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { getTcacheRouteLocationRole } from '@/features/tcache-route-testbed/model/viewModel';
import type { TcacheRouteLocationDraft } from '@/features/tcache-route-testbed/job-builder/tcacheJobBuilderModel';
import { MAX_TCACHE_LOCATIONS } from '@/features/tcache-route-testbed/job-builder/tcacheJobBuilderModel';
import { DragHandle } from '@/shared/ui/DragHandle';

interface TcacheLocationListProps {
  locations: TcacheRouteLocationDraft[];
  selectedLocationId: string | null;
  errors: Record<string, string>;
  onSelect: (locationId: string) => void;
  onUpdateAddress: (locationId: string, address: string) => void;
  onAddEmpty: () => void;
  onRemove: (locationId: string) => void;
  onReorder: (locationId: string, targetIndex: number) => void;
}

interface DragState {
  locationId: string;
  pointerId: number;
  targetIndex: number;
}

export function TcacheLocationList({
  locations,
  selectedLocationId,
  errors,
  onSelect,
  onUpdateAddress,
  onAddEmpty,
  onRemove,
  onReorder,
}: TcacheLocationListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const dragRef = useRef<DragState | null>(null);
  const pointerYRef = useRef(0);
  const frameRef = useRef(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (selectedLocationId) {
      rowRefs.current
        .get(selectedLocationId)
        ?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedLocationId]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  function setDragState(next: DragState | null): void {
    dragRef.current = next;
    setDrag(next);
  }

  function updateTarget(clientY: number): void {
    const current = dragRef.current;
    if (!current) {
      return;
    }
    const rows = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>(
        '[data-tcache-location-id]',
      ) ?? [],
    ).filter((row) => row.dataset.tcacheLocationId !== current.locationId);
    const before = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    const targetIndex = before < 0 ? locations.length - 1 : before;
    const scroll = listRef.current;
    if (scroll) {
      const rect = scroll.getBoundingClientRect();
      if (clientY < rect.top + 44) {
        scroll.scrollTop -= 10;
      }
      if (clientY > rect.bottom - 44) {
        scroll.scrollTop += 10;
      }
    }
    if (targetIndex !== current.targetIndex) {
      setDragState({ ...current, targetIndex });
    }
  }

  function startDrag(
    locationId: string,
    index: number,
    event: PointerEvent<HTMLButtonElement>,
  ): void {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerYRef.current = event.clientY;
    setDragState({
      locationId,
      pointerId: event.pointerId,
      targetIndex: index,
    });
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    pointerYRef.current = event.clientY;
    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        updateTarget(pointerYRef.current);
      });
    }
  }

  function finishDrag(
    event: PointerEvent<HTMLButtonElement>,
    commit: boolean,
  ): void {
    if (dragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    updateTarget(event.clientY);
    const completed = dragRef.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    setDragState(null);
    if (commit && completed) {
      onReorder(completed.locationId, completed.targetIndex);
    }
  }

  function keyboardReorder(
    locationId: string,
    index: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ): void {
    if (!event.altKey) {
      return;
    }
    const offset =
      event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    const target = index + offset;
    if (!offset || target < 0 || target >= locations.length) {
      return;
    }
    event.preventDefault();
    onReorder(locationId, target);
  }

  return (
    <aside className="tcache-builder-location-panel">
      <header className="tcache-section-heading">
        <div>
          <h2 className={Classes.HEADING}>위치 목록</h2>
          <p className={Classes.TEXT_MUTED}>
            첫 위치는 출발지, 마지막 위치는 도착지입니다.
          </p>
        </div>
        <Button
          icon="plus"
          size="small"
          disabled={locations.length >= MAX_TCACHE_LOCATIONS}
          onClick={onAddEmpty}
        >
          위치 추가
        </Button>
      </header>
      <ol ref={listRef} className="tcache-builder-locations">
        {locations.length === 0 ? (
          <NonIdealState
            icon="map-marker"
            title="위치가 없습니다."
            description="장소를 두 개 이상 추가해 주세요."
          />
        ) : (
          locations.map((location, index) => {
            const error = errors[location.id];
            const dragging = drag?.locationId === location.id;
            return (
              <li
                key={location.id}
                ref={(element) => {
                  if (element) {
                    rowRefs.current.set(location.id, element);
                  } else {
                    rowRefs.current.delete(location.id);
                  }
                }}
                data-tcache-location-id={location.id}
                className={`${selectedLocationId === location.id ? 'is-selected' : ''}${dragging ? ' is-dragging' : ''}`}
                onClick={() => onSelect(location.id)}
              >
                <DragHandle
                  label={`${location.name || `${index + 1}번째 위치`} 위치 순서 변경`}
                  dragging={dragging}
                  onPointerDown={(event) =>
                    startDrag(location.id, index, event)
                  }
                  onPointerMove={moveDrag}
                  onPointerUp={(event) => finishDrag(event, true)}
                  onPointerCancel={(event) => finishDrag(event, false)}
                  onLostPointerCapture={(event) => {
                    if (dragRef.current?.pointerId === event.pointerId) {
                      setDragState(null);
                    }
                  }}
                  onKeyDown={(event) =>
                    keyboardReorder(location.id, index, event)
                  }
                />
                <span className="tcache-location-order">{index + 1}</span>
                <div className="tcache-location-copy">
                  {location.placeId || location.lat !== undefined ? (
                    <>
                      <strong>{location.name}</strong>
                      <span>
                        {location.address ??
                          location.placeId ??
                          `${location.lat}, ${location.lng}`}
                      </span>
                    </>
                  ) : (
                    <InputGroup
                      aria-label={`${index + 1}번째 위치 주소`}
                      placeholder="주소 직접 입력 또는 지도에서 선택"
                      value={location.address ?? ''}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        onUpdateAddress(location.id, event.currentTarget.value)
                      }
                    />
                  )}
                  {error ? (
                    <span className="tcache-builder-error">{error}</span>
                  ) : null}
                </div>
                <Tag minimal>
                  {getTcacheRouteLocationRole(index, locations.length)}
                </Tag>
                <Button
                  aria-label={`${location.name || `${index + 1}번째 위치`} 삭제`}
                  icon="cross"
                  size="small"
                  variant="minimal"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(location.id);
                  }}
                />
              </li>
            );
          })
        )}
      </ol>
      <span className={Classes.TEXT_MUTED}>
        {locations.length}/{MAX_TCACHE_LOCATIONS}
      </span>
    </aside>
  );
}
