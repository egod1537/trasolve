export type MapWorkspaceMode = 'edit' | 'readonly';

/** Development/QA presentation flag only; authorization remains server-owned. */
export function resolveMapWorkspaceMode(search: string): MapWorkspaceMode {
  return new URLSearchParams(search).get('readonly') === '1'
    ? 'readonly'
    : 'edit';
}
