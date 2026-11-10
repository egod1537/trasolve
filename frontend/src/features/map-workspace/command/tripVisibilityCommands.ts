import { defineTripCommand, type TripCommand } from './TripCommand';

export function createToggleDayVisibilityCommand(dayId: string): TripCommand {
  return defineTripCommand((trip) => {
    const day = trip.days.find((candidate) => candidate.id === dayId);
    if (day) {
      day.hidden = !day.hidden;
    }
    return trip;
  });
}

/** Derive the target from the current draft, including any queued edits. */
export function createToggleAllDayVisibilityCommand(): TripCommand {
  return defineTripCommand((trip) => {
    const hidden = trip.days.some((day) => !day.hidden);
    for (const day of trip.days) {
      day.hidden = hidden;
    }
    return trip;
  });
}
