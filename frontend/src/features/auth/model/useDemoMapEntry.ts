import { useEffect } from 'react';
import type { DemoStatus } from '@trasolve/shared';
import { isDebugGuestMode } from './debugGuestMode';

export function useDemoMapEntry(
  signedOut: boolean,
  status: DemoStatus | null,
  login: (
    returnTo: string,
    options: { requested: boolean; reset?: boolean },
  ) => Promise<void>,
): void {
  const requested =
    new URLSearchParams(window.location.search).get('demo') === 'true';
  useEffect(() => {
    if (!signedOut) {
      return;
    }
    if (status?.automatic || (requested && status?.available === true)) {
      void login(window.location.pathname + window.location.search, {
        requested,
      });
      return;
    }
    window.location.replace(
      isDebugGuestMode(window.location.search)
        ? '/?debug=1'
        : requested
          ? '/?demo=true'
          : '/',
    );
  }, [login, requested, signedOut, status]);
}
