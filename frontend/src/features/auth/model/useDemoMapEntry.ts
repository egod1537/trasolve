import { useEffect } from 'react';
import type { DemoStatus } from '@trasolve/shared';
import { isDebugGuestMode } from './debugGuestMode';
import { isDemoModeRequested, withDemoRequest } from './demoRequest';

export function useDemoMapEntry(
  signedOut: boolean,
  status: DemoStatus | null,
  login: (
    returnTo: string,
    options: { requested: boolean; reset?: boolean },
  ) => Promise<void>,
): void {
  const requested = isDemoModeRequested();
  useEffect(() => {
    if (!signedOut) {
      return;
    }
    if (requested && status?.available === true) {
      void login(window.location.pathname + window.location.search, {
        requested,
      });
      return;
    }
    window.location.replace(
      isDebugGuestMode(window.location.search)
        ? '/?debug=1'
        : requested
          ? withDemoRequest('/')
          : '/',
    );
  }, [login, requested, signedOut, status]);
}
