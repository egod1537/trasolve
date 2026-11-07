import { tripIdSchema } from '@trasolve/shared';

export type MapWorkspaceMode = 'edit' | 'readonly';

export type MapWorkspaceRouteState = {
  mode: MapWorkspaceMode;
  analyticsMode: boolean;
  debugMode: boolean;
  initialTripId: string | null;
};

/** Development/QA presentation flag only; authorization remains server-owned. */
export function resolveMapWorkspaceRouteState(
  search: string,
): MapWorkspaceRouteState {
  const parameters = new URLSearchParams(search);
  const tripId = tripIdSchema.safeParse(parameters.get('trip'));
  return {
    mode: parameters.get('readonly') === '1' ? 'readonly' : 'edit',
    analyticsMode: parameters.get('analytics') === '1',
    debugMode: parameters.get('debug') === '1',
    initialTripId: tripId.success ? tripId.data : null,
  };
}

export function buildMapWorkspaceTripPath(tripId: string): string {
  const parsedTripId = tripIdSchema.parse(tripId);
  return `/map?trip=${encodeURIComponent(parsedTripId)}`;
}
