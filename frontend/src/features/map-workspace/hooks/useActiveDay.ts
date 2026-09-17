import { useMemo, useState } from 'react';
import type { TripDay } from '@trasolve/shared';

export function useActiveDay(days: readonly TripDay[]) {
  const [activeDayId, setActiveDayId] = useState<string | null>(
    () => days[0]?.id ?? null,
  );
  const selectedDayId =
    activeDayId && days.some((day) => day.id === activeDayId)
      ? activeDayId
      : (days[0]?.id ?? null);

  return useMemo(
    () => ({ activeDayId, selectedDayId, setActiveDayId }),
    [activeDayId, selectedDayId],
  );
}
