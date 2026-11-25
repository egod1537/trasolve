export function isDemoModeRequested(search: string): boolean {
  const value = new URLSearchParams(search).get('demo');
  return value === '1' || value === 'true';
}
