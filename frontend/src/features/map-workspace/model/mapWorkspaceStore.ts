export type MapDetailTarget =
  { type: 'place'; id: string } | { type: 'polyline'; id: string } | null;

export type MapWorkspaceTransientState = {
  searchDismissRevision: number;
  activeMapTool: 'pan';
  routeOptimizationOpen: boolean;
  mapDetailTarget: MapDetailTarget;
};

export type MapWorkspaceTransientAction =
  | { type: 'map-clicked' }
  | { type: 'detail-selected'; target: Exclude<MapDetailTarget, null> }
  | { type: 'detail-closed' }
  | { type: 'map-tool-selected'; tool: 'pan' }
  | { type: 'route-optimization-toggled' }
  | { type: 'route-optimization-closed' };

export const initialMapWorkspaceTransientState: MapWorkspaceTransientState = {
  searchDismissRevision: 0,
  activeMapTool: 'pan',
  routeOptimizationOpen: false,
  mapDetailTarget: null,
};

export function reduceMapWorkspaceTransientState(
  state: MapWorkspaceTransientState,
  action: MapWorkspaceTransientAction,
): MapWorkspaceTransientState {
  switch (action.type) {
    case 'map-clicked':
      return {
        ...state,
        searchDismissRevision: state.searchDismissRevision + 1,
        mapDetailTarget: null,
      };
    case 'detail-selected':
      return { ...state, mapDetailTarget: action.target };
    case 'detail-closed':
      return state.mapDetailTarget
        ? { ...state, mapDetailTarget: null }
        : state;
    case 'map-tool-selected':
      return { ...state, activeMapTool: action.tool };
    case 'route-optimization-toggled':
      return {
        ...state,
        routeOptimizationOpen: !state.routeOptimizationOpen,
      };
    case 'route-optimization-closed':
      return state.routeOptimizationOpen
        ? { ...state, routeOptimizationOpen: false }
        : state;
  }
}
