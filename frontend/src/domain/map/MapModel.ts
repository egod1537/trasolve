import type { MapFocus, MapFocusTarget } from './mapTypes';
import {
  buildTripRoutes,
  type Trip,
  type TripPlace,
  type TripRoute,
} from '../../types/trip';
import { getGeoBounds } from './geometry';

export type MapSnapshot = Readonly<{
  trip: Trip;
  routes: TripRoute[];
  selectedPlaceId: string | null;
  selectedDayId: string | null;
  focus: MapFocus;
  focusTarget: MapFocusTarget;
}>;

type IndexedPlace = {
  dayId: string;
  place: TripPlace;
};

export class MapModel {
  private trip: Trip;
  private routes: TripRoute[];
  private readonly placesById = new Map<string, IndexedPlace>();
  private readonly daysById = new Map<string, Trip['days'][number]>();
  private allPlaces: TripPlace[];
  private readonly listeners = new Set<() => void>();

  private selectedPlaceId: string | null = null;
  private selectedDayId: string | null = null;
  private focus: MapFocus = { type: 'all', revision: 0 };
  private focusTarget: MapFocusTarget;
  private snapshot: MapSnapshot;

  constructor(trip: Trip) {
    this.trip = this.cloneTrip(trip);
    this.routes = [];
    this.allPlaces = [];
    this.rebuildDerivedData();
    this.focusTarget = this.createFocusTarget();
    this.snapshot = this.createSnapshot();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  getTrip(): Trip {
    return this.trip;
  }

  getRoutes(): TripRoute[] {
    return this.routes;
  }

  getSelectedPlaceId(): string | null {
    return this.selectedPlaceId;
  }

  getSelectedDayId(): string | null {
    return this.selectedDayId;
  }

  getFocus(): MapFocus {
    return this.focus;
  }

  selectPlace = (placeId: string): void => {
    const indexedPlace = this.placesById.get(placeId);
    if (!indexedPlace) return;

    this.selectedPlaceId = placeId;
    this.selectedDayId = indexedPlace.dayId;
    this.focus = {
      type: 'place',
      placeId,
      revision: this.focus.revision + 1,
    };
    this.commit();
  };

  selectDay = (dayId: string): void => {
    if (!this.daysById.has(dayId)) return;

    this.selectedPlaceId = null;
    this.selectedDayId = dayId;
    this.focus = {
      type: 'day',
      dayId,
      revision: this.focus.revision + 1,
    };
    this.commit();
  };

  showAll = (): void => {
    this.selectedPlaceId = null;
    this.selectedDayId = null;
    this.focus = { type: 'all', revision: this.focus.revision + 1 };
    this.commit();
  };

  movePlace = (dayId: string, placeId: string, targetIndex: number): void => {
    const day = this.daysById.get(dayId);
    if (!day || !Number.isFinite(targetIndex)) return;

    const sourceIndex = day.places.findIndex((place) => place.id === placeId);
    if (sourceIndex < 0 || day.places.length < 2) return;

    const nextIndex = Math.min(
      day.places.length - 1,
      Math.max(0, Math.trunc(targetIndex)),
    );
    if (sourceIndex === nextIndex) return;

    const reorderedPlaces = [...day.places];
    const [movedPlace] = reorderedPlaces.splice(sourceIndex, 1);
    if (!movedPlace) return;
    reorderedPlaces.splice(nextIndex, 0, movedPlace);

    const normalizedPlaces = reorderedPlaces.map((place, index) => ({
      ...place,
      order: index + 1,
    }));
    this.trip = {
      ...this.trip,
      days: this.trip.days.map((candidate) =>
        candidate.id === dayId
          ? { ...candidate, places: normalizedPlaces }
          : candidate,
      ),
    };
    this.rebuildDerivedData();
    this.commit(false);
  };

  private cloneTrip(trip: Trip): Trip {
    return {
      ...trip,
      days: trip.days.map((day) => ({
        ...day,
        places: day.places.map((place, index) => ({
          ...place,
          order: index + 1,
        })),
      })),
    };
  }

  private rebuildDerivedData(): void {
    this.routes = buildTripRoutes(this.trip.days);
    this.allPlaces = this.trip.days.flatMap((day) => day.places);
    this.daysById.clear();
    this.placesById.clear();

    for (const day of this.trip.days) {
      this.daysById.set(day.id, day);
      for (const place of day.places) {
        this.placesById.set(place.id, { dayId: day.id, place });
      }
    }
  }

  private commit(updateFocusTarget = true): void {
    if (updateFocusTarget) this.focusTarget = this.createFocusTarget();
    this.snapshot = this.createSnapshot();
    for (const listener of this.listeners) listener();
  }

  private createSnapshot(): MapSnapshot {
    return {
      trip: this.trip,
      routes: this.routes,
      selectedPlaceId: this.selectedPlaceId,
      selectedDayId: this.selectedDayId,
      focus: this.focus,
      focusTarget: this.focusTarget,
    };
  }

  private createFocusTarget(): MapFocusTarget {
    if (this.focus.type === 'place') {
      const place = this.placesById.get(this.focus.placeId)?.place;
      if (place) {
        return {
          type: 'place',
          revision: this.focus.revision,
          point: { lat: place.lat, lng: place.lng },
        };
      }
    }

    const places =
      this.focus.type === 'day'
        ? (this.daysById.get(this.focus.dayId)?.places ?? [])
        : this.allPlaces;

    return {
      type: 'bounds',
      revision: this.focus.revision,
      bounds: getGeoBounds(places),
    };
  }
}
