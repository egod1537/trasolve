import type { Trip } from '@trasolve/shared';

export class TripHistory {
  public constructor() {}

  public get canUndo(): boolean {
    return this.past.length > 0;
  }

  public get canRedo(): boolean {
    return this.future.length > 0;
  }

  public record(previous: Trip): void {
    this.past.push(structuredClone(previous));
    this.future = [];
  }

  public getUndoCandidate(): Trip | null {
    const candidate = this.past.at(-1);
    return candidate ? structuredClone(candidate) : null;
  }

  public commitUndo(current: Trip): void {
    this.past.pop();
    this.future.push(structuredClone(current));
  }

  public getRedoCandidate(): Trip | null {
    const candidate = this.future.at(-1);
    return candidate ? structuredClone(candidate) : null;
  }

  public commitRedo(current: Trip): void {
    this.future.pop();
    this.past.push(structuredClone(current));
  }

  private past: Trip[] = [];

  private future: Trip[] = [];
}
