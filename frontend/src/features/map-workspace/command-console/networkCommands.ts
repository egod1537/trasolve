import { commandFingerprint } from './commandFingerprint';
import {
  TravelMode,
  type PlaceAutocompleteSuggestion,
  type MapRoute,
} from '@trasolve/shared';
import { searchPlaces, getPlace } from '@/shared/api/places';
import { getDirections } from '@/shared/api/routes';
import { createTripPlaceFromGooglePlace } from '@/entities/place';
import { formatDistance, formatDuration } from '@/shared/lib/routePresentation';
import type { EditCommandContext } from './editCommands';
import type { CommandHandlers } from './commandRuntime';
import { resolveDay, resolvePlace } from './commandTargets';
export type NetworkCommandState = {
  suggestions: readonly PlaceAutocompleteSuggestion[];
  routes: readonly MapRoute[];
  batches: Map<string, readonly MapRoute[]>;
};
export function createNetworkCommands(
  ctx: EditCommandContext,
  state: NetworkCommandState,
): CommandHandlers {
  const guard = (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (
      commandFingerprint(ctx.trip) !== commandFingerprint(ctx.currentTrip())
    ) {
      throw new Error('STALE_TRIP');
    }
  };
  const lookup = async (query: string, signal: AbortSignal) => {
    const result = await searchPlaces(query, { signal });
    guard(signal);
    if (result.suggestions.length !== 1) {
      throw new Error(
        result.suggestions.length
          ? 'AMBIGUOUS_PLACE_USE_SEARCH_RESULT'
          : 'PLACE_NOT_FOUND',
      );
    }
    return getPlace(result.suggestions[0]!.placeId, { signal });
  };
  const locate = async (reference: string, signal: AbortSignal) => {
    try {
      return resolvePlace(ctx.trip, reference, null).location;
    } catch (error) {
      if (error instanceof Error && error.message === 'AMBIGUOUS_TARGET') {
        throw error;
      }
      return (await lookup(reference, signal)).location;
    }
  };
  return {
    search: async (a, signal) => {
      const locationBias = a.near
        ? { ...(await locate(String(a.near), signal)), radiusMeters: 50000 }
        : undefined;
      const result = await searchPlaces(String(a.query), {
        signal,
        locationBias,
      });
      guard(signal);
      state.suggestions = result.suggestions;
      return {
        items: result.suggestions.map((s) => ({
          label: s.text,
          detail: s.secondaryText,
          command: {
            name: 'place inspect',
            args: {
              placeId: s.placeId,
            },
          },
        })),
        data: result,
      };
    },
    'place inspect': async (a, signal) => {
      const found = await getPlace(String(a.placeId), { signal });
      guard(signal);
      return { data: found, handoff: true };
    },
    'place add': async (a, signal) => {
      const target = resolveDay(ctx.trip, a.day, ctx.ui.selectedDayId);
      const selection =
        a.result === undefined ? null : state.suggestions[Number(a.result) - 1];
      if (
        (a.result !== undefined && !selection) ||
        (a.result !== undefined && a.query !== undefined)
      ) {
        throw new Error('INVALID_SEARCH_RESULT');
      }
      if (
        [a.query, a.result, a.placeId].filter((value) => value !== undefined)
          .length !== 1
      ) {
        throw new Error('QUERY_OR_RESULT_REQUIRED');
      }
      const found = a.placeId
        ? await getPlace(String(a.placeId), { signal })
        : selection
          ? await getPlace(selection.placeId, { signal })
          : await lookup(String(a.query), signal);
      guard(signal);
      if (
        !(await ctx.controller.addPlace(
          target.id,
          createTripPlaceFromGooglePlace(found),
        ))
      ) {
        throw new Error('CHANGE_REJECTED');
      }
      return {
        data: {
          place: found.name,
          day: target.title,
          applied: true,
          saved: false,
        },
      };
    },
    'map goto': async (a, signal) => {
      const location = await locate(String(a.place), signal);
      guard(signal);
      return { data: location };
    },
    'route search': async (a, signal) => {
      const mode = String(a.mode ?? 'transit');
      if (mode === 'straight') {
        throw new Error('INVALID_ROUTE_MODE');
      }
      const from = await locate(String(a.from), signal);
      const to = await locate(String(a.to), signal);
      guard(signal);
      const result = await getDirections(
        {
          origin: { type: 'coordinates', ...from },
          destination: { type: 'coordinates', ...to },
          travelMode:
            mode === 'walking'
              ? TravelMode.WALKING
              : mode === 'driving'
                ? TravelMode.DRIVING
                : TravelMode.TRANSIT,
          computeAlternativeRoutes: true,
        },
        signal,
      );
      guard(signal);
      state.routes =
        mode === 'transit' ? result.routes.slice(0, 5) : result.routes;
      const batch = crypto.randomUUID();
      state.batches.set(batch, state.routes);
      if (state.batches.size > 10) {
        state.batches.delete(state.batches.keys().next().value!);
      }
      return {
        items: state.routes.map((r, i) => ({
          label: formatDuration(r.durationMillis),
          detail: [formatDistance(r.distanceMeters), r.description]
            .filter(Boolean)
            .join(', '),
          command: { name: 'route detail', args: { index: i + 1, batch } },
        })),
      };
    },
    'route detail': (a) => {
      const routes = a.batch
        ? state.batches.get(String(a.batch))
        : state.routes;
      const route = routes?.[Number(a.index) - 1];
      if (!route) {
        throw new Error('ROUTE_NOT_FOUND');
      }
      return {
        data: {
          description: route.description,
          durationMillis: route.durationMillis,
          distanceMeters: route.distanceMeters,
          fare: route.fare,
          legs: route.legs,
        },
      };
    },
  };
}
