import type { ReactNode } from 'react';
import {
  TripMapContext,
  type TripMapContextValue,
} from '../hooks/map/useTripMap';

export function TripMapProvider({
  value,
  children,
}: {
  value: TripMapContextValue;
  children: ReactNode;
}) {
  return (
    <TripMapContext.Provider value={value}>{children}</TripMapContext.Provider>
  );
}
