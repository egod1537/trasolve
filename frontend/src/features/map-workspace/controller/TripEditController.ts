import {
  tripSchema,
  type PlaceStyle,
  type Trip,
  type TripInput,
  type TripPolylineMode,
  type TripScheduleUpdate,
} from '@trasolve/shared';
import {
  defineTripCommand,
  type TripCommand,
} from '@/features/map-workspace/command/TripCommand';
import {
  TripCommandDispatcher,
  type TripHistorySnapshot,
} from '@/features/map-workspace/command/TripCommandDispatcher';
import { parseTripCommandString } from '@/features/map-workspace/command/TripCommandParser';
import type { RegisteredTripCommand } from '@/features/map-workspace/command/TripCommandRegistry';
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
import {
  TripRevisionConflictError,
  type TripRepository,
} from '@/entities/trip';
import type { TripStore } from '@/features/map-workspace/store/TripStore';
import { L } from '@/shared/i18n';

export type { PlaceInput } from '@/features/map-workspace/command/tripCommands';

export type PersistedBatchOutcome =
  | 'committed'
  | 'rejected'
  | 'busy'
  | 'destroyed'
  | 'aborted'
  | 'conflict'
  | 'not_committed'
  | 'unknown_commit';

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

  public readonly subscribeHistory = (listener: () => void): (() => void) =>
    this.commandDispatcher.subscribeHistory(listener);

  public readonly getHistorySnapshot = (): TripHistorySnapshot =>
    this.commandDispatcher.getHistorySnapshot();

  public async save(): Promise<boolean> {
    if (this.persistedCompletion) {
      return this.persistedCompletion;
    }
    if (this.destroyed) {
      return false;
    }
    // While a save is unconfirmed, a PUT would carry a fresh If-Match for a
    // Trip the client has not seen. Only reconcileUnknownCommit may continue.
    if (this.unknownCommit) {
      return false;
    }
    await this.commandCompletion;
    // A confirmed batch can acquire persistence while this save is yielding.
    // Join it rather than saving the pre-Apply snapshot concurrently.
    if (this.persistedCompletion) {
      return this.persistedCompletion;
    }
    if (this.destroyed || this.unknownCommit) {
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
    if (this.destroyed || this.persistedController || this.unknownCommit) {
      return Promise.resolve(false);
    }
    return this.completeLocalChange(this.commandDispatcher.undo());
  }

  public redo(): Promise<boolean> {
    if (this.destroyed || this.persistedController || this.unknownCommit) {
      return Promise.resolve(false);
    }
    return this.completeLocalChange(this.commandDispatcher.redo());
  }

  public executeBatch(commands: readonly TripCommand[]): Promise<boolean> {
    if (
      this.destroyed ||
      this.persistedController ||
      this.unknownCommit ||
      commands.length === 0
    ) {
      return Promise.resolve(false);
    }
    return this.completeLocalChange(
      this.commandDispatcher.executeBatch(commands),
    );
  }

  /** Publish a confirmed batch only after canonical persistence and readback. */
  public executePersistedBatch(
    commands: readonly TripCommand[],
  ): Promise<boolean> {
    return this.executePersistedBatchDetailed(commands).then(
      (outcome) => outcome === 'committed',
    );
  }

  /**
   * Same as executePersistedBatch, but preserves why a batch was not applied.
   * `unknown_commit` means the save result could not be confirmed; the batch is
   * never retried until the canonical Trip is read back successfully.
   */
  public executePersistedBatchDetailed(
    commands: readonly TripCommand[],
  ): Promise<PersistedBatchOutcome> {
    if (this.destroyed) {
      return Promise.resolve('destroyed');
    }
    if (this.unknownCommit) {
      return Promise.resolve('unknown_commit');
    }
    if (commands.length === 0) {
      return Promise.resolve('rejected');
    }
    if (
      this.persistedController ||
      this.pending ||
      this.store.getState().status !== 'ready'
    ) {
      return Promise.resolve('busy');
    }
    const controller = new AbortController();
    this.persistedController = controller;
    const completion = this.runPersistedBatch(commands, controller);
    this.persistedCompletion = completion.then(
      (outcome) => outcome === 'committed',
    );
    return completion;
  }

  public get hasUnknownCommit(): boolean {
    return this.unknownCommit;
  }

  /** Stable primitive snapshot so UI can observe recovery with useSyncExternalStore. */
  public readonly getRecoverySnapshot = (): 'none' | 'unknown_commit' =>
    this.unknownCommit ? 'unknown_commit' : 'none';

  public readonly subscribeRecovery = (listener: () => void): (() => void) => {
    this.recoveryListeners.add(listener);
    return () => {
      this.recoveryListeners.delete(listener);
    };
  };

  /**
   * Read the canonical Trip back after an unconfirmed save and adopt it. This
   * is the only path that clears the unknown state. It refuses to run while
   * local edits are unsaved or a save is in flight, so they are never replaced.
   */
  public async reconcileUnknownCommit(): Promise<boolean> {
    const status = this.store.getState().status;
    if (
      this.destroyed ||
      !this.unknownCommit ||
      this.persistedController ||
      this.pending ||
      this.autosaveTimer !== null ||
      this.flushAfterPending ||
      // A failed save can leave a local edit that was never stored.
      this.revision > this.lastSavedRevision ||
      status === 'dirty' ||
      status === 'saving'
    ) {
      return false;
    }
    const controller = new AbortController();
    this.persistedController = controller;
    try {
      const canonical = await this.repository.getTrip(
        this.tripId,
        controller.signal,
      );
      if (
        this.destroyed ||
        controller.signal.aborted ||
        canonical.id !== this.tripId
      ) {
        return false;
      }
      // An edit may have started while the readback was in flight.
      const current = this.store.getState().status;
      if (
        current === 'dirty' ||
        current === 'saving' ||
        this.revision > this.lastSavedRevision
      ) {
        return false;
      }
      this.commandDispatcher.resetHistory();
      this.setUnknownCommit(false);
      this.revision += 1;
      this.lastSavedRevision = this.revision;
      this.store.setState({ trip: canonical, status: 'ready', error: null });
      return true;
    } catch {
      return false;
    } finally {
      if (this.persistedController === controller) {
        this.persistedController = null;
      }
    }
  }

  public async executeTripCommandString(
    input: string,
  ): Promise<CommandExecutionResult> {
    if (this.destroyed) {
      return {
        success: false,
        commandName: null,
        error: L(
          'map:tripEditController.executeTripCommandString.error.youCannotRunCommandsClosedTrip',
        ),
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

  public destroy(): void {
    this.destroyed = true;
    this.commandDispatcher.resetHistory();
    this.clearAutosaveTimer();
    this.flushAfterPending = false;
    const pending = this.pending;
    this.pending = null;
    this.pendingPromise = null;
    pending?.controller.abort();
    this.persistedController?.abort();
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

  private persistedController: AbortController | null = null;

  private persistedCompletion: Promise<boolean> | null = null;

  private unknownCommit = false;

  private readonly recoveryListeners = new Set<() => void>();

  private setUnknownCommit(value: boolean): void {
    if (this.unknownCommit === value) {
      return;
    }
    this.unknownCommit = value;
    for (const listener of [...this.recoveryListeners]) {
      listener();
    }
  }

  /**
   * Compare Trips ignoring ids the server assigned to entities that did not
   * exist before the batch (pending-* ids are replaced on save). Existing ids
   * are kept verbatim; new ones are labelled by structural position so day,
   * place, polyline and layer-item references stay consistent.
   */
  private semanticKey(trip: Trip, knownIds: ReadonlySet<string>): string {
    const labels = new Map<string, string>();
    trip.days.forEach((day, dayIndex) => {
      if (!knownIds.has(day.id)) {
        labels.set(day.id, `new:day:${dayIndex}`);
      }
      day.places.forEach((place, index) => {
        if (!knownIds.has(place.id)) {
          labels.set(place.id, `new:place:${dayIndex}:${index}`);
        }
      });
      day.polylines.forEach((polyline, index) => {
        if (!knownIds.has(polyline.id)) {
          labels.set(polyline.id, `new:polyline:${dayIndex}:${index}`);
        }
      });
    });
    return JSON.stringify(this.createTripInput(trip)).replace(
      /"((?:[^"\\]|\\.)*)"/g,
      (token, value: string) =>
        labels.has(value) ? JSON.stringify(labels.get(value)) : token,
    );
  }

  private async runPersistedBatch(
    commands: readonly TripCommand[],
    controller: AbortController,
  ): Promise<PersistedBatchOutcome> {
    const before = this.store.getState();
    let staged = before;
    const dispatcher = new TripCommandDispatcher({
      getState: () => staged,
      setState: (state) => {
        staged = state;
      },
      subscribe: () => () => {},
    });
    this.clearAutosaveTimer();
    this.store.setState({ ...before, status: 'saving', error: null });
    let saveAttempted = false;
    try {
      if (!(await dispatcher.executeBatch(commands))) {
        // Nothing was sent to the server; restore the untouched snapshot.
        if (!this.destroyed && !controller.signal.aborted) {
          this.store.setState({ ...before, status: 'ready', error: null });
        }
        if (controller.signal.aborted) {
          return this.destroyed ? 'destroyed' : 'aborted';
        }
        return 'rejected';
      }
      if (controller.signal.aborted) {
        return this.destroyed ? 'destroyed' : 'aborted';
      }
      saveAttempted = true;
      const saved = await this.repository.saveTrip(
        this.tripId,
        this.createTripInput(staged.trip),
        controller.signal,
      );
      const canonical = await this.repository.getTrip(
        this.tripId,
        controller.signal,
      );
      if (this.destroyed || controller.signal.aborted) {
        return this.destroyed ? 'destroyed' : 'aborted';
      }
      if (saved.id !== this.tripId || canonical.id !== this.tripId) {
        throw new Error(
          L(
            'map:tripEditController.error.savedTripDifferentFromCurrentSession',
          ),
        );
      }
      if (
        JSON.stringify(this.createTripInput(saved)) !==
        JSON.stringify(this.createTripInput(canonical))
      ) {
        throw new TripRevisionConflictError(canonical);
      }
      const published = await this.commandDispatcher.execute(
        defineTripCommand(() => canonical),
      );
      if (!published) {
        throw new Error(
          L('map:tripEditController.runSave.error.failedSaveTrip'),
        );
      }
      this.revision += 1;
      this.lastSavedRevision = this.revision;
      this.store.setState({ trip: canonical, status: 'ready', error: null });
      return 'committed';
    } catch (cause) {
      if (this.destroyed || controller.signal.aborted) {
        return this.destroyed ? 'destroyed' : 'aborted';
      }
      if (!saveAttempted) {
        this.store.setState({ ...before, status: 'ready', error: null });
        return 'rejected';
      }
      // A failed response may follow a committed write. Decide only from the
      // canonical Trip: never assume success or failure without reading it.
      let canonical: Trip | null = null;
      if (cause instanceof TripRevisionConflictError) {
        canonical = cause.latestTrip;
      } else {
        try {
          const reloaded = await this.repository.getTrip(
            this.tripId,
            controller.signal,
          );
          canonical = reloaded.id === this.tripId ? reloaded : null;
        } catch {
          canonical = null;
        }
      }
      if (this.destroyed || controller.signal.aborted) {
        return this.destroyed ? 'destroyed' : 'aborted';
      }
      this.commandDispatcher.resetHistory();
      if (!canonical) {
        // UNKNOWN_COMMIT: keep the last confirmed snapshot, block blind retry.
        this.setUnknownCommit(true);
        this.store.setState({
          trip: before.trip,
          status: 'error',
          error: L('map:tripEditController.runSave.error.failedSaveTrip'),
        });
        return 'unknown_commit';
      }
      // Entities that existed before the batch keep their ids; entities the
      // batch created are matched by position, so a committed add_day/add_place
      // is not mistaken for an external change.
      const knownIds = new Set<string>(
        before.trip.days.flatMap((day) => [
          day.id,
          ...day.places.map((place) => place.id),
          ...day.polylines.map((polyline) => polyline.id),
        ]),
      );
      const canonicalKey = this.semanticKey(canonical, knownIds);
      this.revision += 1;
      this.lastSavedRevision = this.revision;
      this.store.setState({ trip: canonical, status: 'ready', error: null });
      // "committed" means the canonical Trip equals the intended result; it does
      // not prove that this particular PUT produced it.
      if (canonicalKey === this.semanticKey(staged.trip, knownIds)) {
        return 'committed';
      }
      return canonicalKey === this.semanticKey(before.trip, knownIds)
        ? 'not_committed'
        : 'conflict';
    } finally {
      if (this.persistedController === controller) {
        this.persistedController = null;
        this.persistedCompletion = null;
      }
    }
  }

  private dispatch(command: TripCommand): Promise<boolean> {
    if (this.destroyed || this.persistedController || this.unknownCommit) {
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
      return L(
        'map:tripEditController.getCommandExecutionError.text.thereNoChangeHistoryRevert',
      );
    }
    if (commandName === 'redo' && !this.commandDispatcher.canRedo) {
      return L(
        'map:tripEditController.getCommandExecutionError.text.thereNoChangeHistoryRedo',
      );
    }
    return (
      this.store.getState().error ??
      L(
        'map:tripEditController.getCommandExecutionError.text.commandExecutionFailed',
      )
    );
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
    if (this.persistedCompletion) {
      return this.persistedCompletion;
    }
    if (this.destroyed || this.unknownCommit) {
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
        throw new Error(
          L(
            'map:tripEditController.error.savedTripDifferentFromCurrentSession',
          ),
        );
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
      if (cause instanceof TripRevisionConflictError) {
        this.flushAfterPending = false;
        this.lastSavedRevision = this.revision;
        this.store.setState({
          trip: cause.latestTrip,
          status: 'error',
          error: cause.message,
        });
        this.commandDispatcher.resetHistory();
        return false;
      }
      const current = this.store.getState();
      this.store.setState({
        ...current,
        status: 'error',
        error:
          cause instanceof Error
            ? cause.message
            : L('map:tripEditController.runSave.error.failedSaveTrip'),
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
