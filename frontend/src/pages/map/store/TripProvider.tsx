import type { ReactNode } from 'react';
import { TripContext, type TripContextValue } from '../hooks/useTrip';

export function TripProvider({
  value,
  children,
}: {
  value: TripContextValue;
  children: ReactNode;
}) {
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
