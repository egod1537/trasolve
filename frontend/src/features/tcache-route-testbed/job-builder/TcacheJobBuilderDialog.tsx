import {
  Button,
  Callout,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Intent,
  Tag,
} from '@blueprintjs/core';
import type { PlaceDetails } from '@trasolve/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toTcacheRouteCreateRequest } from '@/features/tcache-route-testbed/api/tcacheRoute';
import { TcacheLocationList } from '@/features/tcache-route-testbed/job-builder/TcacheLocationList';
import { TcacheRouteMap } from '@/features/tcache-route-testbed/job-builder/TcacheRouteMap';
import { TcacheRouteOptions } from '@/features/tcache-route-testbed/job-builder/TcacheRouteOptions';
import {
  addTcacheLocation,
  createEmptyLocation,
  createTcacheJobBuilderDraft,
  createTcacheLocationFromCoordinate,
  createTcacheLocationFromPlace,
  MAX_TCACHE_LOCATIONS,
  reorderTcacheLocations,
  tcacheJobBuilderToRequest,
  validateTcacheJobBuilder,
  type TcacheJobBuilderState,
} from '@/features/tcache-route-testbed/job-builder/tcacheJobBuilderModel';
import type { TcacheRouteRequest } from '@/features/tcache-route-testbed/model/types';
import type { GeoPoint } from '@/shared/types/mapTypes';

interface TcacheJobBuilderDialogProps {
  isOpen: boolean;
  dark: boolean;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (request: TcacheRouteRequest) => void;
}

export function TcacheJobBuilderDialog({
  isOpen,
  dark,
  submitting,
  error,
  onClose,
  onCreate,
}: TcacheJobBuilderDialogProps) {
  const [builder, setBuilder] = useState(createTcacheJobBuilderDraft);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [viewportRevision, setViewportRevision] = useState(0);
  const wasOpen = useRef(false);
  const validation = useMemo(
    () => validateTcacheJobBuilder(builder),
    [builder],
  );
  const request = useMemo(() => tcacheJobBuilderToRequest(builder), [builder]);
  const requestPreview = useMemo(
    () => (request ? toTcacheRouteCreateRequest(request) : null),
    [request],
  );

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      const next = createTcacheJobBuilderDraft();
      setBuilder(next);
      setSelectedLocationId(next.locations[0]?.id ?? null);
      setViewportRevision((revision) => revision + 1);
    }
    wasOpen.current = isOpen;
  }, [isOpen]);

  function updateBuilder(patch: Partial<TcacheJobBuilderState>): void {
    setBuilder((current) => ({ ...current, ...patch }));
  }

  function addEmptyLocation(): void {
    if (builder.locations.length >= MAX_TCACHE_LOCATIONS) {
      return;
    }
    const location = createEmptyLocation();
    setBuilder((current) => ({
      ...current,
      locations: addTcacheLocation(current.locations, location),
    }));
    setSelectedLocationId(location.id);
  }

  function usePlace(
    place: PlaceDetails,
    action: 'start' | 'waypoint' | 'end',
  ): void {
    if (
      action === 'waypoint' &&
      builder.locations.length >= MAX_TCACHE_LOCATIONS
    ) {
      return;
    }
    const existing = builder.locations.find(
      (location) => location.placeId === place.id,
    );
    if (existing) {
      if (action !== 'waypoint') {
        setBuilder((current) => ({
          ...current,
          locations: moveLocationToRole(current.locations, existing.id, action),
        }));
      }
      setSelectedLocationId(existing.id);
      return;
    }
    const location = createTcacheLocationFromPlace(place);
    setBuilder((current) => {
      if (action === 'waypoint') {
        return {
          ...current,
          locations: addTcacheLocation(current.locations, location),
        };
      }
      const locations = [...current.locations];
      const index = action === 'start' ? 0 : Math.max(0, locations.length - 1);
      if (locations.length === 0) {
        locations.push(location);
      } else {
        locations[index] = location;
      }
      return { ...current, locations };
    });
    setSelectedLocationId(location.id);
    setViewportRevision((revision) => revision + 1);
  }

  function useCoordinate(
    point: GeoPoint,
    action: 'start' | 'waypoint' | 'end',
  ): void {
    if (
      action === 'waypoint' &&
      builder.locations.length >= MAX_TCACHE_LOCATIONS
    ) {
      return;
    }
    const location = createTcacheLocationFromCoordinate(point);
    setBuilder((current) => {
      if (action === 'waypoint') {
        return {
          ...current,
          locations: addTcacheLocation(current.locations, location),
        };
      }
      const locations = [...current.locations];
      const index = action === 'start' ? 0 : Math.max(0, locations.length - 1);
      if (locations.length === 0) {
        locations.push(location);
      } else {
        locations[index] = location;
      }
      return { ...current, locations };
    });
    setSelectedLocationId(location.id);
    setViewportRevision((revision) => revision + 1);
  }

  function submit(): void {
    if (!validation.valid || !request || submitting) {
      return;
    }
    onCreate(request);
  }

  return (
    <Dialog
      className="tcache-builder-dialog"
      isOpen={isOpen}
      portalClassName={dark ? Classes.DARK : undefined}
      title="새 tcache 경로 요청"
      icon="route"
      canEscapeKeyClose={!submitting}
      canOutsideClickClose={!submitting}
      onClose={onClose}
    >
      <DialogBody className="tcache-builder-body">
        <div className="tcache-builder-main-grid">
          <TcacheLocationList
            locations={builder.locations}
            selectedLocationId={selectedLocationId}
            errors={validation.locationErrors}
            onSelect={setSelectedLocationId}
            onUpdateAddress={(locationId, address) =>
              setBuilder((current) => ({
                ...current,
                locations: current.locations.map((location) =>
                  location.id === locationId
                    ? { ...location, name: address.trim(), address }
                    : location,
                ),
              }))
            }
            onAddEmpty={addEmptyLocation}
            onRemove={(locationId) => {
              setBuilder((current) => ({
                ...current,
                locations: current.locations.filter(
                  (location) => location.id !== locationId,
                ),
              }));
              if (selectedLocationId === locationId) {
                setSelectedLocationId(null);
              }
            }}
            onReorder={(locationId, targetIndex) =>
              setBuilder((current) => ({
                ...current,
                locations: reorderTcacheLocations(
                  current.locations,
                  locationId,
                  targetIndex,
                ),
              }))
            }
          />
          <TcacheRouteMap
            locations={builder.locations}
            selectedLocationId={selectedLocationId}
            viewportRevision={viewportRevision}
            onSelectLocation={setSelectedLocationId}
            onUsePlace={usePlace}
            onUseCoordinate={useCoordinate}
          />
        </div>
        <TcacheRouteOptions state={builder} onChange={updateBuilder} />
        <section
          className="tcache-builder-preview"
          aria-labelledby="tcache-preview-title"
        >
          <div className="tcache-section-heading">
            <h2 id="tcache-preview-title">요청 미리보기</h2>
            <Tag
              minimal
              intent={validation.valid ? Intent.SUCCESS : Intent.DANGER}
            >
              {validation.valid ? '유효함' : '수정 필요'}
            </Tag>
          </div>
          <pre>{JSON.stringify(requestPreview, null, 2)}</pre>
        </section>
        {!validation.valid ? (
          <Callout
            compact
            intent={Intent.DANGER}
            title="요청을 확인해 주세요."
            role="alert"
          >
            {validation.messages.join(' ')}
          </Callout>
        ) : null}
        {error ? (
          <Callout compact intent={Intent.DANGER} role="alert">
            {error}
          </Callout>
        ) : null}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button disabled={submitting} onClick={onClose}>
              취소
            </Button>
            <Button
              icon="send-message"
              intent={Intent.PRIMARY}
              loading={submitting}
              disabled={!validation.valid || !request || submitting}
              onClick={submit}
            >
              요청 생성
            </Button>
          </>
        }
      />
    </Dialog>
  );
}

function moveLocationToRole(
  locations: TcacheJobBuilderState['locations'],
  locationId: string,
  role: 'start' | 'end',
): TcacheJobBuilderState['locations'] {
  const location = locations.find((candidate) => candidate.id === locationId);
  if (!location) {
    return locations;
  }
  const remaining = locations.filter(
    (candidate) => candidate.id !== locationId,
  );
  return role === 'start' ? [location, ...remaining] : [...remaining, location];
}
