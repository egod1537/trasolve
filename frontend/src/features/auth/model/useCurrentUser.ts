import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser, GoogleOAuthResult } from '@trasolve/shared';
import {
  consumeGoogleOAuthResult,
  startGoogleOAuth,
} from '@/features/auth/api/googleOAuth';
import {
  fetchCurrentUser,
  loginAsDebugGuest,
  logout as requestLogout,
} from '@/features/auth/api/auth';
import { L } from '@/shared/i18n';

export type CurrentUserState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser };

const oauthErrorMessages: Record<
  Extract<GoogleOAuthResult, { status: 'error' }>['error'],
  string
> = {
  get access_denied() {
    return L(
      'auth:useCurrentUser.oauthErrorMessages.text.googleSignHasBeenCanceled',
    );
  },
  get provider_error() {
    return L(
      'auth:useCurrentUser.oauthErrorMessages.text.googleWasUnableCompleteSignRequest',
    );
  },
  get invalid_callback() {
    return L(
      'auth:useCurrentUser.oauthErrorMessages.text.loginRequestHasExpiredInvalidTry',
    );
  },
  get token_exchange_failed() {
    return L(
      'auth:useCurrentUser.oauthErrorMessages.text.failedProcessVerificationCodeTryAgain',
    );
  },
  get userinfo_request_failed() {
    return L(
      'auth:useCurrentUser.oauthErrorMessages.text.failedRetrieveGoogleProfileInformation',
    );
  },
};

/**
 * Tracks the logged-in Google account for the current session, and finishes
 * the OAuth round trip (`?oauth=complete`) when this page is the one the
 * backend redirected back to after `startGoogleOAuth` login.
 */
export function useCurrentUser() {
  const [state, setState] = useState<CurrentUserState>({ status: 'loading' });
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setState(user ? { status: 'signed-in', user } : { status: 'signed-out' });
    } catch {
      setState({ status: 'signed-out' });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justCompletedOAuth = params.get('oauth') === 'complete';
    let cancelled = false;

    void (async () => {
      if (justCompletedOAuth) {
        try {
          const result = await consumeGoogleOAuthResult();
          if (result.status === 'error') {
            setAuthNotice(oauthErrorMessages[result.error]);
          } else if (result.status === 'unavailable') {
            setAuthNotice(
              L('auth:useCurrentUser.text.googleSignNotSetUpServer'),
            );
          } else if (result.status === 'missing') {
            setAuthNotice(
              L('auth:useCurrentUser.text.weCannotConfirmLoginResultsTry'),
            );
          }
        } catch {
          setAuthNotice(
            L('auth:useCurrentUser.text.failedLoadLoginResultsTryAgain'),
          );
        }

        params.delete('oauth');
        const nextSearch = params.toString();
        window.history.replaceState(
          null,
          '',
          window.location.pathname +
            (nextSearch ? `?${nextSearch}` : '') +
            window.location.hash,
        );
      }

      if (!cancelled) {
        await refresh();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(async (returnTo = window.location.pathname) => {
    setAuthNotice(null);
    if (!import.meta.env.DEV) {
      startGoogleOAuth(returnTo);
      return;
    }

    try {
      const user = await loginAsDebugGuest();
      setState({ status: 'signed-in', user });
      if (returnTo !== window.location.pathname) {
        window.location.assign(returnTo);
      }
    } catch {
      setState({ status: 'signed-out' });
      setAuthNotice(
        L('auth:useCurrentUser.text.failedLoadLoginResultsTryAgain'),
      );
    }
  }, []);

  const loginAsGuest = useCallback(
    async (returnTo = window.location.pathname) => {
      setAuthNotice(null);
      try {
        const user = await loginAsDebugGuest();
        setState({ status: 'signed-in', user });
        if (returnTo !== window.location.pathname + window.location.search) {
          window.location.assign(returnTo);
        }
      } catch {
        setState({ status: 'signed-out' });
        setAuthNotice(
          L('auth:useCurrentUser.text.failedLoadLoginResultsTryAgain'),
        );
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await requestLogout();
    setState({ status: 'signed-out' });
  }, []);

  return useMemo(
    () => ({ state, login, loginAsGuest, logout, refresh, authNotice }),
    [state, login, loginAsGuest, logout, refresh, authNotice],
  );
}
