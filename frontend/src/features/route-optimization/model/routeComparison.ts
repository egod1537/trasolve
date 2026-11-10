import type {
  TripDay,
  TripPlace,
  TripScheduleUpdate,
  TrouteTravelMode,
} from '@trasolve/shared';

export type RouteComparisonMode = 'current' | 'result';

export type RouteComparisonData = {
  day: TripDay;
  update: TripScheduleUpdate;
  fingerprint: string;
  travelMode: TrouteTravelMode;
};

export type RouteComparisonView = {
  data: RouteComparisonData;
  mode: RouteComparisonMode;
  applying: boolean;
  confirming: boolean;
  stale: boolean;
  error: string | null;
  onModeChange: (mode: RouteComparisonMode) => void;
  onExit: () => void;
  onApply: () => void;
  onConfirmApply: () => void;
  onCancelApply: () => void;
};

export function getComparisonPlaces(
  data: RouteComparisonData,
  mode: RouteComparisonMode,
): TripPlace[] {
  if (mode === 'current') {
    return [...data.day.places].sort((a, b) => a.order - b.order);
  }
  const places = new Map(data.day.places.map((place) => [place.id, place]));
  const stops = new Map(data.update.stops.map((stop) => [stop.placeId, stop]));
  return data.update.placeIds.flatMap((id, order) => {
    const place = places.get(id);
    const stop = stops.get(id);
    if (!place || !stop) {
      return [];
    }
    const duration =
      stop.visitDurationMinutes ??
      place.preferredDurationMinutes ??
      place.visitDurationMinutes;
    return [
      {
        ...place,
        order,
        time: stop.time,
        visitDurationMinutes: duration,
        preferredDurationMinutes: duration,
      },
    ];
  });
}
