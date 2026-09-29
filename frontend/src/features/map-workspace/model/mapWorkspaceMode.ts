export type MapWorkspaceMode = 'edit' | 'readonly';

export type MapWorkspaceRouteState = {
  mode: MapWorkspaceMode;
  analyticsMode: boolean;
};

/** Development/QA presentation flag only; authorization remains server-owned. */
export function resolveMapWorkspaceRouteState(
  search: string,
): MapWorkspaceRouteState {
  const parameters = new URLSearchParams(search);
  return {
    mode: parameters.get('readonly') === '1' ? 'readonly' : 'edit',
    analyticsMode: parameters.get('analytics') === '1',
  };
}
