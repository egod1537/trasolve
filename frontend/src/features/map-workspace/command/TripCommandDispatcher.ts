import {
  reconcileDayRouteSegments,
  tripSchema,
  type Trip,
} from '@trasolve/shared';
import type { TripStore } from '@/features/map-workspace/store/TripStore';
import type { TripCommand } from '@/features/map-workspace/command/TripCommand';
import { TripHistory } from '@/features/map-workspace/command/TripHistory';
import { L } from '@/shared/i18n';

type CommandOperation = {
  type: 'command';
  commands: readonly TripCommand[];
};

type HistoryOperation = {
  type: 'undo' | 'redo';
};

type QueuedOperation = {
  operation: CommandOperation | HistoryOperation;
  resolve: (success: boolean) => void;
};

export type TripHistorySnapshot = Readonly<{
  canUndo: boolean;
  canRedo: boolean;
}>;

const EMPTY_HISTORY_SNAPSHOT: TripHistorySnapshot = Object.freeze({
  canUndo: false,
  canRedo: false,
});

export class TripCommandDispatcher {
  public constructor(private readonly store: TripStore) {
    this.history = new TripHistory();
  }

  public get canUndo(): boolean {
    return this.historySnapshot.canUndo;
  }

  public get canRedo(): boolean {
    return this.historySnapshot.canRedo;
  }

  public subscribeHistory(listener: () => void): () => void {
    this.historyListeners.add(listener);
    return () => this.historyListeners.delete(listener);
  }

  public getHistorySnapshot(): TripHistorySnapshot {
    return this.historySnapshot;
  }

  public resetHistory(): void {
    this.history.reset();
    this.publishHistorySnapshot();
  }

  public execute(command: TripCommand): Promise<boolean> {
    return this.enqueue({ type: 'command', commands: [command] });
  }

  public executeBatch(commands: readonly TripCommand[]): Promise<boolean> {
    if (commands.length === 0) {
      return Promise.resolve(false);
    }
    return this.enqueue({ type: 'command', commands: [...commands] });
  }

  public undo(): Promise<boolean> {
    return this.enqueue({ type: 'undo' });
  }

  public redo(): Promise<boolean> {
    return this.enqueue({ type: 'redo' });
  }

  private readonly history: TripHistory;

  private readonly historyListeners = new Set<() => void>();

  private readonly queue: QueuedOperation[] = [];

  private executing = false;

  private historySnapshot = EMPTY_HISTORY_SNAPSHOT;

  private enqueue(
    operation: CommandOperation | HistoryOperation,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.queue.push({ operation, resolve });
      this.drainQueue();
    });
  }

  private applyCommands(commands: readonly TripCommand[]): boolean {
    const current = this.store.getState();
    try {
      let next = structuredClone(current.trip);
      for (const command of commands) {
        next = this.normalizeTrip(command.apply(next));
      }
      this.history.record(current.trip);
      this.store.setState({ trip: next, status: 'dirty', error: null });
      this.publishHistorySnapshot();
      return true;
    } catch {
      this.store.setState({
        ...current,
        status: 'error',
        error: L(
          'map:tripCommandDispatcher.applyCommands.error.travelChangeValueIncorrect',
        ),
      });
      return false;
    }
  }

  private applyHistoryOperation(type: HistoryOperation['type']): boolean {
    const current = this.store.getState();
    const candidate =
      type === 'undo'
        ? this.history.getUndoCandidate()
        : this.history.getRedoCandidate();
    if (!candidate) {
      return false;
    }

    try {
      const next = this.normalizeTrip(candidate);
      if (type === 'undo') {
        this.history.commitUndo(current.trip);
      } else {
        this.history.commitRedo(current.trip);
      }
      this.store.setState({ trip: next, status: 'dirty', error: null });
      this.publishHistorySnapshot();
      return true;
    } catch {
      this.store.setState({
        ...current,
        status: 'error',
        error: L(
          'map:tripCommandDispatcher.applyHistoryOperation.error.tripChangeHistoryCannotBeRestored',
        ),
      });
      return false;
    }
  }

  private applyOperation(
    operation: CommandOperation | HistoryOperation,
  ): boolean {
    return operation.type === 'command'
      ? this.applyCommands(operation.commands)
      : this.applyHistoryOperation(operation.type);
  }

  private drainQueue(): void {
    if (this.executing) {
      return;
    }
    this.executing = true;
    try {
      let queued = this.queue.shift();
      while (queued) {
        queued.resolve(this.applyOperation(queued.operation));
        queued = this.queue.shift();
      }
    } finally {
      this.executing = false;
    }
  }

  private normalizeTrip(trip: Trip): Trip {
    for (const day of trip.days) {
      reconcileDayRouteSegments(day, () => `pending-${crypto.randomUUID()}`);
    }
    return tripSchema.parse(trip);
  }

  private publishHistorySnapshot(): void {
    const next: TripHistorySnapshot = {
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    };
    if (
      next.canUndo === this.historySnapshot.canUndo &&
      next.canRedo === this.historySnapshot.canRedo
    ) {
      return;
    }
    this.historySnapshot = next;
    this.historyListeners.forEach((listener) => listener());
  }
}
