export type Coordinates = { lat: number; lng: number };

export type TripPlace = Coordinates & {
  id: string;
  name: string;
  description: string;
  time?: string;
  order: number;
};

export type TripDay = {
  id: string;
  title: string;
  date?: string;
  color: string;
  places: TripPlace[];
};

export type Trip = {
  title: string;
  period: string;
  days: TripDay[];
};

// A route is independent of its provider. Routes API geometry can replace path.
export type TripRoute = { dayId: string; color: string; path: Coordinates[] };

export type MapFocus = { revision: number } & (
  | { type: 'all' }
  | { type: 'day'; dayId: string }
  | { type: 'place'; placeId: string }
);

export function orderedPlaces(day: TripDay) {
  return [...day.places].sort((a, b) => a.order - b.order);
}

export function buildTripRoutes(days: TripDay[]): TripRoute[] {
  return days.map((day) => ({
    dayId: day.id,
    color: day.color,
    path: orderedPlaces(day).map(({ lat, lng }) => ({ lat, lng })),
  }));
}
