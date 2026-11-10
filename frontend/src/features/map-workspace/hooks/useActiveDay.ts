import { useCallback, useMemo, useState } from 'react';
import type { TripDay } from '@trasolve/shared';

export function useActiveDay(
  days: readonly TripDay[],
  visibleDayIds: ReadonlySet<string>,
) {
  const [activeDayId, setStoredActiveDayId] = useState<string | null>(
    () => days.find((day) => visibleDayIds.has(day.id))?.id ?? null,
  );
  const selectedDayId =
    activeDayId &&
    visibleDayIds.has(activeDayId) &&
    days.some((day) => day.id === activeDayId)
      ? activeDayId
      : (days.find((day) => visibleDayIds.has(day.id))?.id ?? null);
  if (activeDayId !== selectedDayId) {
    setStoredActiveDayId(selectedDayId);
  }
  const setActiveDayId = useCallback(
    (id: string | null) => {
      if (id === null || visibleDayIds.has(id)) {
        setStoredActiveDayId(id);
      }
    },
    [visibleDayIds],
  );

  return useMemo(
    () => ({ activeDayId, selectedDayId, setActiveDayId }),
    [activeDayId, selectedDayId, setActiveDayId],
  );
}
