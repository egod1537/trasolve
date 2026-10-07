import { useEffect, useRef, useState } from 'react';
import { ANALYTICS_SCREENS, type Trip } from '@trasolve/shared';
import { getDirections } from '@/shared/api/routes';
import { TripEditController } from '@/features/map-workspace/controller/TripEditController';
import type { QueryRouteDuration } from '@/features/map-workspace/domain/routeDuration';
import type { TripRepository } from '@/entities/trip';
import { createTripStore } from '@/features/map-workspace/store/createTripStore';
import { TripProvider } from '@/features/map-workspace/store/TripProvider';
import { MapWorkspace } from '@/features/map-workspace/ui/MapWorkspace';
import { toRouteSummaryViewModel } from '@/features/map-workspace/model/routeViewModel';
import { useScreenView } from '@/shared/analytics';

const queryRouteDuration: QueryRouteDuration = async (request, signal) => {
  const result = await getDirections(request, signal);
  return toRouteSummaryViewModel(result).durationMillis;
};

type EditTripSessionProps = {
  mode?: 'edit';
  trip: Trip;
  repository: TripRepository;
  onOpenTripPicker: () => void;
  debugMode: boolean;
};

type ReadonlyTripSessionProps = {
  mode: 'readonly';
  trip: Trip;
  repository?: never;
  onOpenTripPicker?: never;
};

export type TripSessionProps = EditTripSessionProps | ReadonlyTripSessionProps;

/** The workspace keys this component by Trip ID; each mount owns one session. */
export function TripSession(props: TripSessionProps) {
  if (props.mode === 'readonly') {
    return <ReadonlyTripSession trip={props.trip} />;
  }

  return (
    <EditTripSession
      trip={props.trip}
      repository={props.repository}
      onOpenTripPicker={props.onOpenTripPicker}
      debugMode={props.debugMode}
    />
  );
}

function EditTripSession({
  trip,
  repository,
  onOpenTripPicker,
  debugMode,
}: EditTripSessionProps) {
  useScreenView(ANALYTICS_SCREENS.mapWorkspace);
  const [application] = useState(() => {
    const store = createTripStore(trip);
    return {
      mode: 'edit' as const,
      store,
      controller: new TripEditController(store, repository, {
        debouncedAutosave: true,
      }),
    };
  });
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (destroyTimerRef.current !== null) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }

    return () => {
      // StrictMode immediately sets the effect up again after its development
      // cleanup check. Defer permanent disposal so that setup can cancel it.
      destroyTimerRef.current = setTimeout(() => {
        application.controller.destroy();
        destroyTimerRef.current = null;
      }, 0);
    };
  }, [application]);

  return (
    <TripProvider value={application}>
      <MapWorkspace
        mode="edit"
        onQueryRouteDuration={queryRouteDuration}
        onOpenTripPicker={onOpenTripPicker}
        debugMode={debugMode}
      />
    </TripProvider>
  );
}

function ReadonlyTripSession({ trip }: { trip: Trip }) {
  const [application] = useState(() => ({
    mode: 'readonly' as const,
    store: createTripStore(trip),
  }));

  return (
    <TripProvider value={application}>
      <MapWorkspace mode="readonly" />
    </TripProvider>
  );
}
