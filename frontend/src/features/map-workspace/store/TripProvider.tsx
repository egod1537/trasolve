import type { ReactNode } from 'react';
import {
  TripContext,
  type TripContextValue,
} from '@/features/map-workspace/hooks/useTrip';

export function TripProvider({
  value,
  children,
}: {
  value: TripContextValue;
  children: ReactNode;
}) {
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
