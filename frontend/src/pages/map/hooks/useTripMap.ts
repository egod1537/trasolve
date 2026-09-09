import { createContext, useContext, useSyncExternalStore } from 'react';
import type { TripMapController } from '../controller/TripMapController';
import type { TripMapStore } from '../store/TripMapStore';

export type TripMapContextValue = {
  store: TripMapStore;
  controller: TripMapController;
};

export const TripMapContext = createContext<TripMapContextValue | null>(null);

function useApplication() {
  const value = useContext(TripMapContext);
  if (!value) throw new Error('TripMapProvider가 필요합니다.');
  return value;
}

export function useTripMapState() {
  const { store } = useApplication();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

export function useTripMapController() {
  return useApplication().controller;
}
