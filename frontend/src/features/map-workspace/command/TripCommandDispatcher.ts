import {
  reconcileDayRouteSegments,
  tripSchema,
  type Trip,
} from '@trasolve/shared';
import type { TripStore } from '@/features/map-workspace/store/TripStore';
import type { TripCommand } from '@/features/map-workspace/command/TripCommand';
import { TripHistory } from '@/features/map-workspace/command/TripHistory';

type CommandOperation = {
  type: 'command';
  command: TripCommand;
};

type HistoryOperation = {
  type: 'undo' | 'redo';
};

type QueuedOperation = {
  operation: CommandOperation | HistoryOperation;
  resolve: (success: boolean) => void;
};

export class TripCommandDispatcher {
  public constructor(private readonly store: TripStore) {
    this.history = new TripHistory();
  }

  public get canUndo(): boolean {
    return this.history.canUndo;
  }

  public get canRedo(): boolean {
    return this.history.canRedo;
  }

  public execute(command: TripCommand): Promise<boolean> {
    return this.enqueue({ type: 'command', command });
  }

  public undo(): Promise<boolean> {
    return this.enqueue({ type: 'undo' });
  }

  public redo(): Promise<boolean> {
    return this.enqueue({ type: 'redo' });
  }

  private readonly history: TripHistory;

  private readonly queue: QueuedOperation[] = [];

  private executing = false;

  private enqueue(
    operation: CommandOperation | HistoryOperation,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.queue.push({ operation, resolve });
      this.drainQueue();
    });
  }

  private applyCommand(command: TripCommand): boolean {
    const current = this.store.getState();
    try {
      const next = this.normalizeTrip(
        command.apply(structuredClone(current.trip)),
      );
      this.history.record(current.trip);
      this.store.setState({ trip: next, status: 'dirty', error: null });
      return true;
    } catch {
      this.store.setState({
        ...current,
        status: 'error',
        error: '여행 변경 값이 올바르지 않습니다.',
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
      return true;
    } catch {
      this.store.setState({
        ...current,
        status: 'error',
        error: '여행 변경 기록을 복원할 수 없습니다.',
      });
      return false;
    }
  }

  private applyOperation(
    operation: CommandOperation | HistoryOperation,
  ): boolean {
    return operation.type === 'command'
      ? this.applyCommand(operation.command)
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
}
