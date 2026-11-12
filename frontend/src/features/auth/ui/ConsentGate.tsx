import { useEffect } from 'react';
import { LEGAL_PATHS } from '@trasolve/shared';
import { fetchConsentStatus } from '../api/consent';
import { AUTH_SESSION_EVENT } from '@/shared/api/authEvents';
import { withMobileLayout } from '@/shared/config/mobileLayout';

/** Server authorization enforces this too; this gate only guides the user. */
export function ConsentGate() {
  useEffect(() => {
    const path = window.location.pathname.replace(/\/$/, '');
    if (Object.values(LEGAL_PATHS).some((publicPath) => path === publicPath)) {
      return;
    }
    const controller = new AbortController();
    let revision = 0;
    const check = async () => {
      const current = ++revision;
      try {
        const result = await fetchConsentStatus(controller.signal);
        if (
          !controller.signal.aborted &&
          current === revision &&
          result.status === 'required'
        ) {
          const url = new URL(
            withMobileLayout(LEGAL_PATHS.consent),
            window.location.origin,
          );
          url.searchParams.set(
            'returnTo',
            window.location.pathname +
              window.location.search +
              window.location.hash,
          );
          window.location.replace(url);
        }
      } catch {
        // Network failures do not grant access; the server still checks consent.
      }
    };
    const reload = () => {
      void check();
    };
    reload();
    window.addEventListener(AUTH_SESSION_EVENT, reload);
    window.addEventListener('focus', reload);
    return () => {
      controller.abort();
      window.removeEventListener(AUTH_SESSION_EVENT, reload);
      window.removeEventListener('focus', reload);
    };
  }, []);
  return null;
}
