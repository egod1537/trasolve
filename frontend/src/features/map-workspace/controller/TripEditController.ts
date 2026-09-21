import {
  tripSchema,
  type PlaceStyle,
  type Trip,
  type TripInput,
  type TripPolylineMode,
} from '@trasolve/shared';
import type { TripCommand } from '@/features/map-workspace/command/TripCommand';
import { TripCommandDispatcher } from '@/features/map-workspace/command/TripCommandDispatcher';
import { parseTripCommandString } from '@/features/map-workspace/command/TripCommandParser';
import type { RegisteredTripCommand } from '@/features/map-workspace/command/TripCommandRegistry';
import {
  createAddDayCommand,
  createAddPlaceCommand,
  createMoveDayCommand,
  createMovePlaceCommand,
  createRemovePlaceCommand,
  createRemovePlacesCommand,
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
import type { TripRepository } from '@/entities/trip';
import type { TripStore } from '@/features/map-workspace/store/TripStore';

export type { PlaceInput } from '@/features/map-workspace/command/tripCommands';

export type CommandExecutionResult = {
  success: boolean;
  commandName: string | null;
  error: string | null;
};

export type TripEditControllerOptions = {
  debouncedAutosave: boolean;
};

type PendingSave = {
  controller: AbortController;
  revision: number;
};

const AUTOSAVE_DELAY_MS = 700;

export class TripEditController {
  public constructor(
    private readonly store: TripStore,
    private readonly repository: TripRepository,
    options: TripEditControllerOptions,
  ) {
    this.tripId = tripSchema.parse(store.getState().trip).id;
    this.debouncedAutosave = options.debouncedAutosave;
    this.commandDispatcher = new TripCommandDispatcher(store);
  }

  public async save(): Promise<boolean> {
    if (this.destroyed) {
      return false;
    }
    await this.commandCompletion;
    if (this.destroyed) {
      return false;
    }

    const targetRevision = this.revision;
    const currentStatus = this.store.getState().status;
    this.clearAutosaveTimer();
    if (this.lastSavedRevision >= targetRevision && currentStatus !== 'error') {
      return true;
    }

    const activeSave = this.pendingPromise;
    const activeRevision = this.pending?.revision;
    if (activeSave) {
      if (activeRevision !== undefined && targetRevision > activeRevision) {
        this.flushAfterPending = true;
      }
      const saved = await activeSave;
      if (this.destroyed) {
        return false;
      }
      if (this.lastSavedRevision >= targetRevision) {
        return true;
      }
      if (!saved && activeRevision === targetRevision) {
        return false;
      }
    }

    return this.pendingPromise ?? this.startSave();
  }

  public get canUndo(): boolean {
    return !this.destroyed && this.commandDispatcher.canUndo;
  }

  public get canRedo(): boolean {
    return !this.destroyed && this.commandDispatcher.canRedo;
  }

  public undo(): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }
    return this.completeLocalChange(this.commandDispatcher.undo());
  }

  public redo(): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }
    return this.completeLocalChange(this.commandDispatcher.redo());
  }

  public async executeTripCommandString(
    input: string,
  ): Promise<CommandExecutionResult> {
    if (this.destroyed) {
      return {
        success: false,
        commandName: null,
        error: '종료된 여행 편집기에서는 명령을 실행할 수 없습니다.',
      };
    }

    const parsed = parseTripCommandString(input);
    if (!parsed.success) {
      return parsed;
    }

    const { commandName, operation } = parsed.parsed;
    const success = await this.executeRegisteredCommand(operation);
    return {
      success,
      commandName,
      error: success ? null : this.getCommandExecutionError(commandName),
    };
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

  /** targetIndex is zero-based, matching the sidebar drag/drop contract. */
  public moveDay(dayId: string, targetIndex: number): Promise<boolean> {
    return this.dispatch(createMoveDayCommand(dayId, targetIndex));
  }

  /** targetIndex is zero-based in the target Day's Place order. */
  public movePlace(
    placeId: string,
    targetDayId: string,
    targetIndex: number,
  ): Promise<boolean> {
    return this.dispatch(
      createMovePlaceCommand(placeId, targetDayId, targetIndex),
    );
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

  public destroy(): void {
    this.destroyed = true;
    this.clearAutosaveTimer();
    this.flushAfterPending = false;
    const pending = this.pending;
    this.pending = null;
    this.pendingPromise = null;
    pending?.controller.abort();
  }

  private readonly tripId: string;

  private readonly debouncedAutosave: boolean;

  private readonly commandDispatcher: TripCommandDispatcher;

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  private commandCompletion: Promise<void> = Promise.resolve();

  private destroyed = false;

  private flushAfterPending = false;

  private lastSavedRevision = 0;

  private pending: PendingSave | null = null;

  private pendingPromise: Promise<boolean> | null = null;

  private revision = 0;

  private dispatch(command: TripCommand): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }
    return this.completeLocalChange(this.commandDispatcher.execute(command));
  }

  private executeRegisteredCommand(
    operation: RegisteredTripCommand,
  ): Promise<boolean> {
    if (operation.type === 'command') {
      return this.dispatch(operation.command);
    }
    return operation.type === 'undo' ? this.undo() : this.redo();
  }

  private getCommandExecutionError(commandName: string): string {
    if (commandName === 'undo' && !this.commandDispatcher.canUndo) {
      return '되돌릴 변경 기록이 없습니다.';
    }
    if (commandName === 'redo' && !this.commandDispatcher.canRedo) {
      return '다시 실행할 변경 기록이 없습니다.';
    }
    return this.store.getState().error ?? '명령 실행에 실패했습니다.';
  }

  private completeLocalChange(execution: Promise<boolean>): Promise<boolean> {
    const completion = execution.then((success) => {
      if (!success || this.destroyed) {
        return false;
      }
      this.revision += 1;
      this.queueAutosave();
      return true;
    });
    this.commandCompletion = completion.then(() => undefined);
    return completion;
  }

  private clearAutosaveTimer(): void {
    if (this.autosaveTimer === null) {
      return;
    }
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
  }

  private createTripInput(trip: Trip): TripInput {
    return {
      title: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: trip.days.map((day) => ({
        ...day,
        places: day.places.map((place) => ({ ...place })),
        polylines: day.polylines.map((polyline) => ({ ...polyline })),
        layerItems: day.layerItems.map((layerItem) => ({ ...layerItem })),
      })),
    };
  }

  private queueAutosave(): void {
    if (this.debouncedAutosave) {
      this.scheduleAutosave();
      return;
    }

    this.clearAutosaveTimer();
    if (this.pending) {
      this.flushAfterPending = true;
      return;
    }
    void this.startSave();
  }

  private scheduleAutosave(): void {
    this.clearAutosaveTimer();
    // A newer edit restarts the debounce window, even while a save is active.
    this.flushAfterPending = false;
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      if (this.destroyed) {
        return;
      }
      if (this.pending) {
        this.flushAfterPending = true;
        return;
      }
      void this.startSave();
    }, AUTOSAVE_DELAY_MS);
  }

  private startSave(): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    this.clearAutosaveTimer();
    const current = this.store.getState();
    const pending: PendingSave = {
      controller: new AbortController(),
      revision: this.revision,
    };
    this.pending = pending;
    this.store.setState({ ...current, status: 'saving', error: null });
    const promise = this.runSave(pending, this.createTripInput(current.trip));
    this.pendingPromise = promise;
    return promise;
  }

  private async runSave(
    pending: PendingSave,
    input: TripInput,
  ): Promise<boolean> {
    try {
      const saved = await this.repository.saveTrip(
        this.tripId,
        input,
        pending.controller.signal,
      );
      if (
        this.destroyed ||
        this.pending !== pending ||
        pending.controller.signal.aborted
      ) {
        return false;
      }
      if (saved.id !== this.tripId) {
        throw new Error('저장된 여행이 현재 세션과 다릅니다.');
      }
      this.lastSavedRevision = Math.max(
        this.lastSavedRevision,
        pending.revision,
      );
      const current = this.store.getState();
      if (this.revision === pending.revision) {
        this.store.setState({ trip: saved, status: 'ready', error: null });
      } else {
        this.store.setState({
          trip: { ...current.trip, updatedAt: saved.updatedAt },
          status: 'dirty',
          error: null,
        });
      }
      return true;
    } catch (cause) {
      if (
        this.destroyed ||
        this.pending !== pending ||
        pending.controller.signal.aborted
      ) {
        return false;
      }
      const current = this.store.getState();
      this.store.setState({
        ...current,
        status: 'error',
        error:
          cause instanceof Error ? cause.message : '여행 저장에 실패했습니다.',
      });
      return false;
    } finally {
      if (this.pending === pending) {
        this.pending = null;
        this.pendingPromise = null;
        const shouldFlush =
          this.flushAfterPending &&
          this.revision > this.lastSavedRevision &&
          !this.destroyed;
        this.flushAfterPending = false;
        if (shouldFlush) {
          void this.startSave();
        }
      }
    }
  }
}
