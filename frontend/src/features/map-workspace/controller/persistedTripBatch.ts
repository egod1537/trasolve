import { type Trip } from '@trasolve/shared';
import {
  defineTripCommand,
  type TripCommand,
} from '@/features/map-workspace/command/TripCommand';
import { TripCommandDispatcher } from '@/features/map-workspace/command/TripCommandDispatcher';

import {
  TripRevisionConflictError,
  type TripRepository,
} from '@/entities/trip';
import type { TripStore } from '@/features/map-workspace/store/TripStore';
import { L } from '@/shared/i18n';
import { createTripInput, semanticTripKey } from './tripPersistenceMapping';
export type PersistedBatchOutcome =
  | 'committed'
  | 'rejected'
  | 'busy'
  | 'destroyed'
  | 'aborted'
  | 'conflict'
  | 'not_committed'
  | 'unknown_commit';
type PersistedBatchContext = {
  store: TripStore;
  repository: TripRepository;
  tripId: string;
  dispatcher: TripCommandDispatcher;
  isDestroyed: () => boolean;
  clearAutosaveTimer: () => void;
  publish: (trip: Trip) => void;
  markUnknown: () => void;
  release: () => void;
};
export async function runPersistedTripBatch(
  commands: readonly TripCommand[],
  controller: AbortController,
  context: PersistedBatchContext,
): Promise<PersistedBatchOutcome> {
  const before = context.store.getState();
  let staged = before;
  const dispatcher = new TripCommandDispatcher({
    getState: () => staged,
    setState: (state) => {
      staged = state;
    },
    subscribe: () => () => {},
  });
  context.clearAutosaveTimer();
  context.store.setState({ ...before, status: 'saving', error: null });
  let saveAttempted = false;
  try {
    if (!(await dispatcher.executeBatch(commands))) {
      // Nothing was sent to the server; restore the untouched snapshot.
      if (!context.isDestroyed() && !controller.signal.aborted) {
        context.store.setState({ ...before, status: 'ready', error: null });
      }
      if (controller.signal.aborted) {
        return context.isDestroyed() ? 'destroyed' : 'aborted';
      }
      return 'rejected';
    }
    if (controller.signal.aborted) {
      return context.isDestroyed() ? 'destroyed' : 'aborted';
    }
    saveAttempted = true;
    const saved = await context.repository.saveTrip(
      context.tripId,
      createTripInput(staged.trip),
      controller.signal,
    );
    const canonical = await context.repository.getTrip(
      context.tripId,
      controller.signal,
    );
    if (context.isDestroyed() || controller.signal.aborted) {
      return context.isDestroyed() ? 'destroyed' : 'aborted';
    }
    if (saved.id !== context.tripId || canonical.id !== context.tripId) {
      throw new Error(
        L('map:tripEditController.error.savedTripDifferentFromCurrentSession'),
      );
    }
    if (
      JSON.stringify(createTripInput(saved)) !==
      JSON.stringify(createTripInput(canonical))
    ) {
      throw new TripRevisionConflictError(canonical);
    }
    const published = await context.dispatcher.execute(
      defineTripCommand(() => canonical),
    );
    if (!published) {
      throw new Error(L('map:tripEditController.runSave.error.failedSaveTrip'));
    }
    context.publish(canonical);
    return 'committed';
  } catch (cause) {
    if (context.isDestroyed() || controller.signal.aborted) {
      return context.isDestroyed() ? 'destroyed' : 'aborted';
    }
    if (!saveAttempted) {
      context.store.setState({ ...before, status: 'ready', error: null });
      return 'rejected';
    }
    // A failed response may follow a committed write. Decide only from the
    // canonical Trip: never assume success or failure without reading it.
    let canonical: Trip | null = null;
    if (cause instanceof TripRevisionConflictError) {
      canonical = cause.latestTrip;
    } else {
      try {
        const reloaded = await context.repository.getTrip(
          context.tripId,
          controller.signal,
        );
        canonical = reloaded.id === context.tripId ? reloaded : null;
      } catch {
        canonical = null;
      }
    }
    if (context.isDestroyed() || controller.signal.aborted) {
      return context.isDestroyed() ? 'destroyed' : 'aborted';
    }
    context.dispatcher.resetHistory();
    if (!canonical) {
      // UNKNOWN_COMMIT: keep the last confirmed snapshot, block blind retry.
      context.markUnknown();
      context.store.setState({
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
    const canonicalKey = semanticTripKey(canonical, knownIds);
    context.publish(canonical);
    // "committed" means the canonical Trip equals the intended result; it does
    // not prove that this particular PUT produced it.
    if (canonicalKey === semanticTripKey(staged.trip, knownIds)) {
      return 'committed';
    }
    return canonicalKey === semanticTripKey(before.trip, knownIds)
      ? 'not_committed'
      : 'conflict';
  } finally {
    context.release();
  }
}
