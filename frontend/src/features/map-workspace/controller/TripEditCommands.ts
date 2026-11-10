import {
  type PlaceStyle,
  type TripPolylineMode,
  type TripScheduleUpdate,
} from '@trasolve/shared';
import { type TripCommand } from '@/features/map-workspace/command/TripCommand';
import {
  createToggleAllDayVisibilityCommand,
  createToggleDayVisibilityCommand,
} from '../command/tripVisibilityCommands';

import {
  createAddDayCommand,
  createAddPlaceCommand,
  createApplyOptimizedScheduleCommand,
  createMoveDayCommand,
  createMovePlaceCommand,
  createRemovePlaceCommand,
  createRemovePlacesCommand,
  createReorderDayPlacesCommand,
  createShuffleDayPlacesCommand,
  createRenameDayCommand,
  createRenameTripCommand,
  createUpdateDayColorCommand,
  createUpdateMemoCommand,
  createUpdatePlaceCommand,
  createUpdatePlaceStyleCommand,
  createUpdatePreferredDurationCommand,
  createUpdatePolylineModeCommand,
  createUpdatePolylineModesCommand,
  createUpdateVisitTimeRangeCommand,
  type PlaceInput,
} from '@/features/map-workspace/command/tripCommands';

/** Named editing operations share the controller's single command dispatch path. */
export abstract class TripEditCommands {
  public toggleDayVisibility(dayId: string): Promise<boolean> {
    return this.dispatch(createToggleDayVisibilityCommand(dayId));
  }

  public toggleAllDayVisibility(): Promise<boolean> {
    return this.dispatch(createToggleAllDayVisibilityCommand());
  }

  public renameTrip(title: string): Promise<boolean> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return Promise.resolve(false);
    }

    return this.dispatch(createRenameTripCommand(normalizedTitle));
  }

  public addDay(title: string): Promise<boolean> {
    return this.dispatch(createAddDayCommand(title));
  }

  public renameDay(dayId: string, title: string): Promise<boolean> {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      return Promise.resolve(false);
    }

    return this.dispatch(createRenameDayCommand(dayId, normalizedTitle));
  }

  public updateDayColor(dayId: string, color: string): Promise<boolean> {
    return this.dispatch(createUpdateDayColorCommand(dayId, color));
  }

  public addPlace(dayId: string, input: PlaceInput): Promise<boolean> {
    return this.dispatch(createAddPlaceCommand(dayId, input));
  }

  public removePlace(placeId: string): Promise<boolean> {
    return this.dispatch(createRemovePlaceCommand(placeId));
  }

  public removePlaces(placeIds: readonly string[]): Promise<boolean> {
    const uniquePlaceIds = new Set(placeIds);
    if (uniquePlaceIds.size === 0) {
      return Promise.resolve(false);
    }
    return this.dispatch(createRemovePlacesCommand([...uniquePlaceIds]));
  }

  /** targetIndex is zero-based in the sidebar order. */
  public moveDay(dayId: string, targetIndex: number): Promise<boolean> {
    return this.dispatch(createMoveDayCommand(dayId, targetIndex));
  }

  /** targetIndex is zero-based in the target day. */
  public movePlace(
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ): Promise<boolean> {
    return this.dispatch(
      createMovePlaceCommand(placeId, targetDayId, targetIndex),
    );
  }

  public reorderDayPlaces(
    dayId: string,
    placeIds: readonly string[],
  ): Promise<boolean> {
    return this.dispatch(createReorderDayPlacesCommand(dayId, placeIds));
  }

  public shuffleDayPlaces(dayId: string): Promise<boolean> {
    return this.dispatch(createShuffleDayPlacesCommand(dayId));
  }

  public applyOptimizedSchedule(
    dayId: string,
    schedule: TripScheduleUpdate,
  ): Promise<boolean> {
    return this.dispatch(createApplyOptimizedScheduleCommand(dayId, schedule));
  }

  public updatePlace(
    placeId: string,
    patch: Partial<PlaceInput>,
  ): Promise<boolean> {
    return this.dispatch(createUpdatePlaceCommand(placeId, patch));
  }

  public updateMemo(placeId: string, memo: string): Promise<boolean> {
    return this.dispatch(createUpdateMemoCommand(placeId, memo));
  }

  public updateVisitTimeRange(
    placeId: string,
    time: string,
    visitDurationMinutes: number,
  ): Promise<boolean> {
    return this.dispatch(
      createUpdateVisitTimeRangeCommand(placeId, time, visitDurationMinutes),
    );
  }

  public updatePreferredDuration(
    placeId: string,
    preferredDurationMinutes: number,
  ): Promise<boolean> {
    return this.dispatch(
      createUpdatePreferredDurationCommand(placeId, preferredDurationMinutes),
    );
  }

  public updatePlaceStyle(
    placeId: string,
    placeStyle: PlaceStyle,
  ): Promise<boolean> {
    return this.dispatch(createUpdatePlaceStyleCommand(placeId, placeStyle));
  }

  public updatePolylineMode(
    polylineId: string,
    mode: TripPolylineMode,
  ): Promise<boolean> {
    return this.dispatch(createUpdatePolylineModeCommand(polylineId, mode));
  }

  public updatePolylineModes(
    polylineIds: readonly string[],
    mode: TripPolylineMode,
  ): Promise<boolean> {
    const uniquePolylineIds = new Set(polylineIds);
    if (uniquePolylineIds.size === 0) {
      return Promise.resolve(false);
    }
    return this.dispatch(
      createUpdatePolylineModesCommand([...uniquePolylineIds], mode),
    );
  }
  protected abstract dispatch(command: TripCommand): Promise<boolean>;
}
