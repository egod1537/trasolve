import { runTripSave, type PendingSave } from './tripAutosave';
import {
  executeTripCommandInput,
  type CommandExecutionResult,
} from './tripCommandExecution';
export type { CommandExecutionResult } from './tripCommandExecution';
import { TripEditCommands } from './TripEditCommands';
import {
  runPersistedTripBatch,
  type PersistedBatchOutcome,
} from './persistedTripBatch';
import { createTripInput } from './tripPersistenceMapping';
export type { PersistedBatchOutcome } from './persistedTripBatch';
import { tripSchema, type TripInput } from '@trasolve/shared';
import { type TripCommand } from '@/features/map-workspace/command/TripCommand';
import {
  TripCommandDispatcher,
  type TripHistorySnapshot,
} from '@/features/map-workspace/command/TripCommandDispatcher';

import { type TripRepository } from '@/entities/trip';
import type { TripStore } from '@/features/map-workspace/store/TripStore';

export type { PlaceInput } from '@/features/map-workspace/command/tripCommands';

export type TripEditControllerOptions = {
  debouncedAutosave: boolean;
};

const AUTOSAVE_DELAY_MS = 700;

export class TripEditController extends TripEditCommands {
  public constructor(
    private readonly store: TripStore,
    private readonly repository: TripRepository,
    options: TripEditControllerOptions,
  ) {
    super();
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

  public executeTripCommandString(
    input: string,
  ): Promise<CommandExecutionResult> {
    return executeTripCommandInput(input, {
      destroyed: this.destroyed,
      canUndo: () => this.canUndo,
      canRedo: () => this.canRedo,
      dispatch: (command) => this.dispatch(command),
      undo: () => this.undo(),
      redo: () => this.redo(),
      getError: () => this.store.getState().error,
    });
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

  private runPersistedBatch(
    commands: readonly TripCommand[],
    controller: AbortController,
  ): Promise<PersistedBatchOutcome> {
    return runPersistedTripBatch(commands, controller, {
      store: this.store,
      repository: this.repository,
      tripId: this.tripId,
      dispatcher: this.commandDispatcher,
      isDestroyed: () => this.destroyed,
      clearAutosaveTimer: () => this.clearAutosaveTimer(),
      publish: (canonical) => {
        this.revision += 1;
        this.lastSavedRevision = this.revision;
        this.store.setState({ trip: canonical, status: 'ready', error: null });
      },
      markUnknown: () => this.setUnknownCommit(true),
      release: () => {
        if (this.persistedController === controller) {
          this.persistedController = null;
          this.persistedCompletion = null;
        }
      },
    });
  }

  protected dispatch(command: TripCommand): Promise<boolean> {
    if (this.destroyed || this.persistedController || this.unknownCommit) {
      return Promise.resolve(false);
    }
    return this.completeLocalChange(this.commandDispatcher.execute(command));
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
    const promise = this.runSave(pending, createTripInput(current.trip));
    this.pendingPromise = promise;
    return promise;
  }

  private runSave(pending: PendingSave, input: TripInput): Promise<boolean> {
    return runTripSave(pending, input, {
      repository: this.repository,
      store: this.store,
      tripId: this.tripId,
      isCurrent: () =>
        !this.destroyed &&
        this.pending === pending &&
        !pending.controller.signal.aborted,
      getRevision: () => this.revision,
      markSaved: (revision) => {
        this.lastSavedRevision = Math.max(this.lastSavedRevision, revision);
      },
      stopFlushing: () => {
        this.flushAfterPending = false;
      },
      resetHistory: () => this.commandDispatcher.resetHistory(),
      release: () => {
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
      },
    });
  }
}
