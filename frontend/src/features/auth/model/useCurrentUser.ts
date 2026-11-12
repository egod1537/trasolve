import { withMobileLayout } from '@/shared/config/mobileLayout';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuthUser, GoogleOAuthResult } from '@trasolve/shared';
import { consumeGoogleOAuthResult } from '@/features/auth/api/googleOAuth';
import {
  fetchCurrentUser,
  loginAsDebugGuest,
  logout as requestLogout,
} from '@/features/auth/api/auth';
import { getExternalApiDisabledMessage } from '@/shared/api/externalApiDisabled';
import { useLoginDialog } from './loginDialogContext';
import {
  readLastLoginProvider,
  rememberLastLoginProvider,
} from './lastLoginProvider';
import { L } from '@/shared/i18n';
import { AUTH_SESSION_EVENT } from '@/shared/api/authEvents';

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
 * Tracks the logged-in account for the current session, and finishes
 * the OAuth round trip (`?oauth=complete`) when this page is the one the
 * backend redirected back to after either login provider.
 */
export function useCurrentUser() {
  const openLoginDialog = useLoginDialog();
  const [state, setState] = useState<CurrentUserState>({ status: 'loading' });
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      if (user && !readLastLoginProvider()) {
        rememberLastLoginProvider(user.loginProvider);
      }
      setState(user ? { status: 'signed-in', user } : { status: 'signed-out' });
    } catch {
      setState({ status: 'signed-out' });
    }
  }, []);

  useEffect(() => {
    const reload = () => {
      void refresh();
    };
    window.addEventListener(AUTH_SESSION_EVENT, reload);
    return () => window.removeEventListener(AUTH_SESSION_EVENT, reload);
  }, [refresh]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justCompletedOAuth = params.get('oauth') === 'complete';
    let cancelled = false;

    void (async () => {
      if (justCompletedOAuth) {
        try {
          const result = await consumeGoogleOAuthResult();
          if (result.status === 'success') {
            rememberLastLoginProvider(
              result.provider ?? result.user.loginProvider,
            );
          } else if (result.status === 'error') {
            setAuthNotice(
              result.provider === 'ssu' && result.error !== 'invalid_callback'
                ? L('auth:useCurrentUser.text.failedLoadLoginResultsTryAgain')
                : oauthErrorMessages[result.error],
            );
          } else if (result.status === 'disabled') {
            setAuthNotice(
              getExternalApiDisabledMessage(
                result.provider === 'ssu' ? 'ssu-sso' : 'google-oauth',
              ),
            );
          } else if (result.status === 'unavailable') {
            setAuthNotice(
              result.provider === 'ssu'
                ? L('auth:useCurrentUser.text.failedLoadLoginResultsTryAgain')
                : L('auth:useCurrentUser.text.googleSignNotSetUpServer'),
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

  const login = useCallback(
    (returnTo = window.location.pathname) => {
      setAuthNotice(null);
      openLoginDialog(withMobileLayout(returnTo));
    },
    [openLoginDialog],
  );

  const loginAsGuest = useCallback(
    async (returnTo = window.location.pathname) => {
      returnTo = withMobileLayout(returnTo);
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
