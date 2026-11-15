import { useCallback, useMemo, useState } from 'react';
import type { TripDay } from '@trasolve/shared';
import type { TripEditController } from '../controller/TripEditController';

export function useDayVisibility(
  days: readonly TripDay[],
  controller?: TripEditController,
) {
  // Shared-trip viewers may adjust their view without editing the owner's trip.
  const [viewerOverrides, setViewerOverrides] = useState<
    ReadonlyMap<string, boolean>
  >(() => new Map());
  const visibleDayIds = useMemo(
    () =>
      new Set(
        days
          .filter(
            (day) =>
              !(controller
                ? day.hidden
                : (viewerOverrides.get(day.id) ?? day.hidden)),
          )
          .map((day) => day.id),
      ),
    [controller, days, viewerOverrides],
  );

  const toggleDayVisibility = useCallback(
    (dayId: string) => {
      if (controller) {
        void controller.toggleDayVisibility(dayId);
        return;
      }
      setViewerOverrides((current) => {
        const day = days.find((candidate) => candidate.id === dayId);
        if (!day) {
          return current;
        }
        return new Map(current).set(dayId, !(current.get(dayId) ?? day.hidden));
      });
    },
    [controller, days],
  );

  const toggleAllDayVisibility = useCallback(() => {
    if (controller) {
      void controller.toggleAllDayVisibility();
      return;
    }
    setViewerOverrides((current) => {
      const hidden = days.some((day) => !(current.get(day.id) ?? day.hidden));
      return new Map(days.map((day) => [day.id, hidden]));
    });
  }, [controller, days]);

  return useMemo(
    () => ({ visibleDayIds, toggleDayVisibility, toggleAllDayVisibility }),
    [toggleDayVisibility, toggleAllDayVisibility, visibleDayIds],
  );
}
