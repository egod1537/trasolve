import { commandFingerprint } from './commandFingerprint';
import type { TripScheduleUpdate, TripDay } from '@trasolve/shared';
import {
  optimizeDayRoute,
  createDayOptimizationSettings,
  createRouteOptimizationRequest,
  getBestOptimizationCandidate,
  createRouteOptimizationSchedule,
  createTripScheduleUpdate,
  isApplicableCandidate,
} from '@/features/route-optimization';
import type { EditCommandContext } from './editCommands';
import type { CommandHandlers } from './commandRuntime';
import { resolveDay } from './commandTargets';
export type OptimizationCommandState = {
  preview?: { day: TripDay; fingerprint: string; update: TripScheduleUpdate };
};
export function createOptimizationCommands(
  ctx: EditCommandContext,
  state: OptimizationCommandState,
  open: () => void,
): CommandHandlers {
  return {
    optimize: async (a, signal) => {
      const day = resolveDay(ctx.trip, a.day, ctx.ui.selectedDayId);
      if (
        a.start === undefined &&
        a.end === undefined &&
        a.mode === undefined
      ) {
        ctx.ui.selectDay(day.id);
        open();
        return { handoff: true };
      }
      if (a.mode === 'straight') {
        throw new Error('INVALID_OPTIMIZATION_MODE');
      }
      const source = structuredClone(day);
      const settings = {
        ...createDayOptimizationSettings(source),
        ...(a.start
          ? { startPolicy: 'fixed' as const, startTime: String(a.start) }
          : {}),
        ...(a.mode
          ? {
              travelMode: (a.mode === 'walking'
                ? 'WALKING'
                : a.mode === 'driving'
                  ? 'DRIVING'
                  : 'TRANSIT') as 'WALKING' | 'DRIVING' | 'TRANSIT',
            }
          : {}),
      };
      const request = createRouteOptimizationRequest(source, settings);
      if (a.end) {
        for (const location of request.locations) {
          location.close_time =
            location.close_time > String(a.end)
              ? String(a.end)
              : location.close_time;
        }
      }
      const result = await optimizeDayRoute(request, () => {}, signal);
      signal.throwIfAborted();
      if (
        commandFingerprint(ctx.trip) !== commandFingerprint(ctx.currentTrip())
      ) {
        throw new Error('STALE_TRIP');
      }
      const candidate = getBestOptimizationCandidate(result);
      const schedule = createRouteOptimizationSchedule(
        result,
        candidate,
        source,
      );
      if (!schedule || !isApplicableCandidate(candidate, source, settings)) {
        throw new Error('NO_APPLICABLE_SCHEDULE');
      }
      state.preview = {
        day: source,
        fingerprint: JSON.stringify(day),
        update: createTripScheduleUpdate(
          schedule,
          settings.selectedStartPlaceId,
          settings.selectedEndPlaceId,
          result.skipped_locations?.map((p) => p.location_id) ?? [],
        ),
      };
      return {
        expectedTrip: commandFingerprint(ctx.trip),
        data: { dayId: day.id, stops: schedule.stops, applied: false },
        items: [
          {
            label: 'optimize apply',
            command: { name: 'optimize apply', args: {} },
          },
        ],
      };
    },
    'optimize apply': async () => {
      const preview = state.preview;
      if (!preview) {
        throw new Error('OPTIMIZATION_PREVIEW_REQUIRED');
      }
      const current = ctx.trip.days.find((d) => d.id === preview.day.id);
      if (JSON.stringify(current) !== preview.fingerprint) {
        state.preview = undefined;
        throw new Error('STALE_OPTIMIZATION_PREVIEW');
      }
      if (
        !(await ctx.controller.applyOptimizedSchedule(
          preview.day.id,
          preview.update,
        ))
      ) {
        throw new Error('CHANGE_REJECTED');
      }
      state.preview = undefined;
      return { data: { applied: true, saved: false } };
    },
  };
}
