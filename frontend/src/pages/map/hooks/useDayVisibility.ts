import { useCallback, useMemo, useState } from 'react';
import type { TripDay } from '@trasolve/shared';

export function useDayVisibility(days: readonly TripDay[]) {
  const [hiddenDayIds, setHiddenDayIds] = useState<Set<string>>(
    () => new Set(),
  );
  const visibleDayIds = useMemo(
    () =>
      new Set(
        days.filter((day) => !hiddenDayIds.has(day.id)).map((day) => day.id),
      ),
    [days, hiddenDayIds],
  );

  const toggleDayVisibility = useCallback((dayId: string) => {
    setHiddenDayIds((current) => {
      const next = new Set(current);
      if (next.has(dayId)) {
        next.delete(dayId);
      } else {
        next.add(dayId);
      }
      return next;
    });
  }, []);

  return useMemo(
    () => ({ visibleDayIds, toggleDayVisibility }),
    [toggleDayVisibility, visibleDayIds],
  );
}
