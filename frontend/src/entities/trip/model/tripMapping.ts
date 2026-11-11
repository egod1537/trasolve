import type {
  Trip,
  TripDay,
  TripPlace,
  TripPolyline,
  TripInput,
} from '@trasolve/shared';
import type { Trip as TripView } from '@/entities/trip/model/trip';

function memoizeObject<Input extends object, Output extends object>(
  convert: (input: Input) => Output,
): (input: Input) => Output {
  const cache = new WeakMap<Input, Output>();
  return (input) => {
    const cached = cache.get(input);
    if (cached) {
      return cached;
    }
    const output = convert(input);
    cache.set(input, output);
    return output;
  };
}

/** Own one mapper per workspace; inputs must be immutable store snapshots. */
export function createTripViewMapper() {
  const mapPlace = memoizeObject((place: TripPlace) => ({
    ...place,
    ...place.location,
    description: place.memo ?? '',
  }));
  const mapPolyline = memoizeObject((polyline: TripPolyline) => ({
    ...polyline,
    path: polyline.path?.map((point) => ({ ...point })),
  }));
  const mapPlaces = memoizeObject((places: TripPlace[]) =>
    places.map(mapPlace),
  );
  const mapPolylines = memoizeObject((polylines: TripPolyline[]) =>
    polylines.map(mapPolyline),
  );
  const mapItems = memoizeObject((items: TripDay['layerItems']) =>
    items.map((item) => ({ ...item })),
  );
  const mapDay = memoizeObject((day: TripDay) => ({
    ...day,
    places: mapPlaces(day.places),
    polylines: mapPolylines(day.polylines),
    layerItems: mapItems(day.layerItems),
  }));
  const mapDays = memoizeObject((days: TripDay[]) => days.map(mapDay));
  let previous: TripView | undefined;
  return (trip: Trip, undatedPeriod: string): TripView => {
    const days = mapDays(trip.days);
    const period =
      [trip.startDate, trip.endDate].filter(Boolean).join(' — ') ||
      undatedPeriod;
    if (
      previous?.title === trip.title &&
      previous.period === period &&
      previous.days === days
    ) {
      return previous;
    }
    previous = { title: trip.title, period, days };
    return previous;
  };
}

/** One-off conversion; recurring immutable snapshots should use a workspace mapper. */
export function tripToView(trip: Trip, undatedPeriod: string): TripView {
  return createTripViewMapper()(trip, undatedPeriod);
}

export function tripViewToInput(view: TripView, stored?: Trip): TripInput {
  const places = new Map(
    stored?.days.flatMap((day) =>
      day.places.map((place) => [place.id, place] as const),
    ),
  );
  return {
    title: view.title,
    startDate: stored?.startDate,
    endDate: stored?.endDate,
    days: view.days.map((day) => ({
      id: stored ? day.id : undefined,
      title: day.title,
      hidden: day.hidden,
      date: stored?.days.find((item) => item.id === day.id)?.date,
      color: day.color,
      places: day.places.map((place) => ({
        id: place.id,
        placeId: place.placeId ?? places.get(place.id)?.placeId,
        address: place.address ?? places.get(place.id)?.address,
        name: place.name,
        location: { lat: place.lat, lng: place.lng },
        order: place.order,
        memo: place.description,
        openingHours: place.openingHours ?? places.get(place.id)?.openingHours,
        placeStyle: place.placeStyle ?? places.get(place.id)?.placeStyle,
        visitDurationMinutes:
          place.visitDurationMinutes ??
          places.get(place.id)?.visitDurationMinutes,
        preferredDurationMinutes:
          place.preferredDurationMinutes ??
          places.get(place.id)?.preferredDurationMinutes,
        time: place.time,
      })),
      polylines: day.polylines.map((polyline) => ({
        ...polyline,
        id: polyline.id,
        path: polyline.path?.map((point) => ({ ...point })),
      })),
      layerItems: day.layerItems.map((item) => ({ ...item })),
    })),
  };
}
