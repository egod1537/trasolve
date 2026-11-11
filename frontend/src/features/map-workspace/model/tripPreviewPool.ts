import type { Trip } from '@trasolve/shared';

export type TripPreviewSlot = {
  id: number;
  target: HTMLElement | null;
  trip: Trip;
};
type PreviewEntry = { trip: Trip; visible: boolean };

function assignVisibleSlots(
  slots: readonly TripPreviewSlot[],
  entries: ReadonlyMap<HTMLElement, PreviewEntry>,
): TripPreviewSlot[] {
  const visible = new Map(
    [...entries].filter(
      ([target, entry]) => target.isConnected && entry.visible,
    ),
  );
  const next = slots.map((slot) => ({
    ...slot,
    target: slot.target && visible.has(slot.target) ? slot.target : null,
    trip: (slot.target && visible.get(slot.target)?.trip) || slot.trip,
  }));
  const assigned = new Set(next.map((slot) => slot.target));
  for (const [target, { trip }] of visible) {
    if (assigned.has(target)) {
      continue;
    }
    // Prefer the previous owner when revisiting a card, otherwise recycle an
    // offscreen slot. GoogleMap itself remains mounted at its stable portal.
    const free =
      next.find((slot) => !slot.target && slot.trip.id === trip.id) ??
      next.find((slot) => !slot.target);
    if (free) {
      free.target = target;
      free.trip = trip;
    } else {
      next.push({ id: next.length, target, trip });
    }
  }
  return next;
}

// One picker session owns the pool. Slots grow to the peak visible card count,
// then move between cards instead of creating a map for every visited trip.
export function createTripPreviewPool() {
  const entries = new Map<HTMLElement, PreviewEntry>();
  const subscribers = new Set<() => void>();
  let slots: readonly TripPreviewSlot[] = [];
  let observer: IntersectionObserver | null = null;
  let frame = 0;

  const reconcile = () => {
    frame = 0;
    const next = assignVisibleSlots(slots, entries);
    if (
      next.length === slots.length &&
      next.every(
        (slot, index) =>
          slot.target === slots[index]?.target &&
          slot.trip === slots[index]?.trip,
      )
    ) {
      return;
    }
    slots = next;
    for (const subscriber of subscribers) {
      subscriber();
    }
  };
  const schedule = () => {
    if (!frame && observer) {
      frame = requestAnimationFrame(reconcile);
    }
  };

  return {
    getSnapshot: () => slots,
    subscribe(callback: () => void) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    register(target: HTMLElement, trip: Trip) {
      const entry: PreviewEntry = { trip, visible: false };
      entries.set(target, entry);
      observer?.observe(target);
      schedule();
      return () => {
        if (entries.get(target) !== entry) {
          return;
        }
        observer?.unobserve(target);
        entries.delete(target);
        schedule();
      };
    },
    start() {
      observer = new IntersectionObserver(
        (changes) => {
          for (const change of changes) {
            const entry = entries.get(change.target as HTMLElement);
            if (entry) {
              entry.visible =
                change.isIntersecting && change.intersectionRatio > 0;
            }
          }
          schedule();
        },
        { threshold: [0, 0.01] },
      );
      for (const target of entries.keys()) {
        observer.observe(target);
      }
      schedule();
      return () => {
        observer?.disconnect();
        observer = null;
        cancelAnimationFrame(frame);
        frame = 0;
      };
    },
  };
}

export type TripPreviewPoolModel = ReturnType<typeof createTripPreviewPool>;
