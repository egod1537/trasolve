import {
  MapWorkspaceFeature,
  resolveMapWorkspaceRouteState,
} from '@/features/map-workspace';

export default function MapPage() {
  const routeState = resolveMapWorkspaceRouteState(window.location.search);
  return <MapWorkspaceFeature {...routeState} />;
}
