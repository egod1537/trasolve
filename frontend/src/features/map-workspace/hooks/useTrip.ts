import { createContext, useContext, useSyncExternalStore } from 'react';
import type { TripEditController } from '@/features/map-workspace/controller/TripEditController';
import type { MapWorkspaceMode } from '@/features/map-workspace/model/mapWorkspaceMode';
import type { TripStore } from '@/features/map-workspace/store/TripStore';
import { L } from '@/shared/i18n';

export type TripContextValue =
  | {
      mode: 'edit';
      store: TripStore;
      controller: TripEditController;
    }
  | {
      mode: 'readonly';
      store: TripStore;
    };

export const TripContext = createContext<TripContextValue | null>(null);

function useApplication() {
  const value = useContext(TripContext);
  if (!value) {
    throw new Error(L('map:useTrip.error.tripproviderRequired'));
  }
  return value;
}

export function useTripState() {
  const { store } = useApplication();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useTripEditController() {
  const application = useApplication();
  if (application.mode !== 'edit') {
    throw new Error(L('map:useTrip.error.tripproviderRequired'));
  }
  return application.controller;
}

export function useTripMode(): MapWorkspaceMode {
  return useApplication().mode;
}

/** Subscribe to domain data without rerendering for save-status-only changes. */
export function useTripData() {
  const { store } = useApplication();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().trip,
    () => store.getState().trip,
  );
}

/** Read the latest immutable Trip after awaits without subscribing a second store. */
export function useTripSnapshotReader() {
  const { store } = useApplication();
  return () => store.getState().trip;
}

/** Subscribe to persistence failures without dirty/saving notifications. */
export function useTripError() {
  const { store } = useApplication();
  return useSyncExternalStore(
    store.subscribe,
    () => store.getState().error,
    () => store.getState().error,
  );
}
