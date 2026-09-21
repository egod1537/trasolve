import { createContext, useContext, useSyncExternalStore } from 'react';
import type { TripEditController } from '@/features/map-workspace/controller/TripEditController';
import type { TripStore } from '@/features/map-workspace/store/TripStore';

export type TripContextValue = {
  store: TripStore;
  controller: TripEditController;
};

export const TripContext = createContext<TripContextValue | null>(null);

function useApplication() {
  const value = useContext(TripContext);
  if (!value) {
    throw new Error('TripProvider가 필요합니다.');
  }
  return value;
}

export function useTripState() {
  const { store } = useApplication();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useTripEditController() {
  return useApplication().controller;
}
