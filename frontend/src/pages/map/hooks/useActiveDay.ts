import { useMemo, useState } from 'react';
import type { TripDay } from '@trasolve/shared';

export function useActiveDay(
  days: readonly TripDay[],
  visibleDayIds: ReadonlySet<string>,
) {
  const [activeDayId, setActiveDayId] = useState<string | null>(
    () => days[0]?.id ?? null,
  );
  const selectedDayId =
    activeDayId && visibleDayIds.has(activeDayId)
      ? activeDayId
      : (days.find((day) => visibleDayIds.has(day.id))?.id ?? null);

  return useMemo(
    () => ({ activeDayId, selectedDayId, setActiveDayId }),
    [activeDayId, selectedDayId],
  );
}
