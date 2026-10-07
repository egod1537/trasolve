import { buildInfo } from '@/shared/config/buildInfo';

export function isDebugGuestMode(search: string): boolean {
  if (buildInfo.channel === 'production') {
    return false;
  }
  return new URLSearchParams(search).get('debug') === '1';
}
