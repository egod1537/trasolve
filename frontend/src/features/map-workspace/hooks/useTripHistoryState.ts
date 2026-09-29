import { useSyncExternalStore } from 'react';
import type { TripHistorySnapshot } from '@/features/map-workspace/command/TripCommandDispatcher';
import type { TripEditController } from '@/features/map-workspace/controller/TripEditController';

export function useTripHistoryState(
  controller: TripEditController,
): TripHistorySnapshot {
  return useSyncExternalStore(
    controller.subscribeHistory,
    controller.getHistorySnapshot,
    controller.getHistorySnapshot,
  );
}
