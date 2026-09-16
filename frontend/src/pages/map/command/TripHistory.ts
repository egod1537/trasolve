import type { Trip } from '@trasolve/shared';

export class TripHistory {
  public constructor(initialPresent: Trip) {
    this.present = structuredClone(initialPresent);
  }

  public get canUndo(): boolean {
    return this.past.length > 0;
  }

  public get canRedo(): boolean {
    return this.future.length > 0;
  }

  public record(previous: Trip, present: Trip): void {
    this.past.push(structuredClone(previous));
    this.present = structuredClone(present);
    this.future = [];
  }

  public getUndoCandidate(): Trip | null {
    const candidate = this.past.at(-1);
    return candidate ? structuredClone(candidate) : null;
  }

  public commitUndo(current: Trip, present: Trip): void {
    this.past.pop();
    this.future.push(structuredClone(current));
    this.present = structuredClone(present);
  }

  public getRedoCandidate(): Trip | null {
    const candidate = this.future.at(-1);
    return candidate ? structuredClone(candidate) : null;
  }

  public commitRedo(current: Trip, present: Trip): void {
    this.future.pop();
    this.past.push(structuredClone(current));
    this.present = structuredClone(present);
  }

  private past: Trip[] = [];

  private present: Trip;

  private future: Trip[] = [];
}
