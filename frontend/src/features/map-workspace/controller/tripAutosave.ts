import type { TripInput } from '@trasolve/shared';
import {
  TripRevisionConflictError,
  type TripRepository,
} from '@/entities/trip';
import type { TripStore } from '../store/TripStore';
import { L } from '@/shared/i18n';
export type PendingSave = { controller: AbortController; revision: number };
type SaveContext = {
  repository: TripRepository;
  store: TripStore;
  tripId: string;
  isCurrent: () => boolean;
  getRevision: () => number;
  markSaved: (revision: number) => void;
  stopFlushing: () => void;
  resetHistory: () => void;
  release: () => void;
};
export async function runTripSave(
  pending: PendingSave,
  input: TripInput,
  context: SaveContext,
): Promise<boolean> {
  try {
    const saved = await context.repository.saveTrip(
      context.tripId,
      input,
      pending.controller.signal,
    );
    if (!context.isCurrent()) {
      return false;
    }
    if (saved.id !== context.tripId) {
      throw new Error(
        L('map:tripEditController.error.savedTripDifferentFromCurrentSession'),
      );
    }
    context.markSaved(pending.revision);
    const current = context.store.getState();
    if (context.getRevision() === pending.revision) {
      context.store.setState({ trip: saved, status: 'ready', error: null });
    } else {
      context.store.setState({
        trip: { ...current.trip, updatedAt: saved.updatedAt },
        status: 'dirty',
        error: null,
      });
    }
    return true;
  } catch (cause) {
    if (!context.isCurrent()) {
      return false;
    }
    if (cause instanceof TripRevisionConflictError) {
      context.stopFlushing();
      context.markSaved(context.getRevision());
      context.store.setState({
        trip: cause.latestTrip,
        status: 'error',
        error: cause.message,
      });
      context.resetHistory();
      return false;
    }
    const current = context.store.getState();
    context.store.setState({
      ...current,
      status: 'error',
      error:
        cause instanceof Error
          ? cause.message
          : L('map:tripEditController.runSave.error.failedSaveTrip'),
    });
    return false;
  } finally {
    context.release();
  }
}
