import { isDebugMode } from '@/shared/config/debugMode';

export function isDebugGuestMode(search: string): boolean {
  return isDebugMode(search);
}
