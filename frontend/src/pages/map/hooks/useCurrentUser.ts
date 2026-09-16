import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GoogleOAuthResult, GoogleOAuthUser } from '@trasolve/shared';
import {
  consumeGoogleOAuthResult,
  startGoogleOAuth,
} from '../../../api/googleOAuth';
import { fetchCurrentUser, logout as requestLogout } from '../../../api/auth';

export type CurrentUserState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: GoogleOAuthUser };

const oauthErrorMessages: Record<
  Extract<GoogleOAuthResult, { status: 'error' }>['error'],
  string
> = {
  access_denied: 'Google 로그인이 취소되었습니다.',
  provider_error: 'Google에서 로그인 요청을 완료하지 못했습니다.',
  invalid_callback:
    '로그인 요청이 만료되었거나 유효하지 않습니다. 다시 시도해 주세요.',
  token_exchange_failed: '인증 코드를 처리하지 못했습니다. 다시 시도해 주세요.',
  userinfo_request_failed: 'Google 프로필 정보를 가져오지 못했습니다.',
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
      setState(
        user ? { status: 'signed-in', user } : { status: 'signed-out' },
      );
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
              'Google 로그인이 서버에 설정되어 있지 않습니다. 관리자에게 문의해 주세요.',
            );
          } else if (result.status === 'missing') {
            setAuthNotice(
              '로그인 결과를 확인할 수 없습니다. 다시 시도해 주세요.',
            );
          }
        } catch {
          setAuthNotice('로그인 결과를 불러오지 못했습니다. 다시 시도해 주세요.');
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

  const login = useCallback(() => {
    setAuthNotice(null);
    startGoogleOAuth(window.location.pathname);
  }, []);

  const logout = useCallback(async () => {
    await requestLogout();
    setState({ status: 'signed-out' });
  }, []);

  return useMemo(
    () => ({ state, login, logout, refresh, authNotice }),
    [state, login, logout, refresh, authNotice],
  );
}
