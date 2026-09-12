import { Component, useEffect, useState } from 'react';
import type { GoogleOAuthResult } from '@trasolve/shared';
import {
  consumeGoogleOAuthResult,
  startGoogleOAuth,
} from '../../api/googleOAuth';
import './styles/testbed.css';
import './styles/google-oauth-test.css';

type OAuthErrorCode = Extract<GoogleOAuthResult, { status: 'error' }>['error'];

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; result: GoogleOAuthResult }
  | { status: 'request_error' };

const errorMessages: Record<OAuthErrorCode, string> = {
  access_denied: 'Google authorization was cancelled or denied.',
  provider_error: 'Google could not complete the authorization request.',
  invalid_callback: 'The OAuth callback was missing or no longer valid.',
  token_exchange_failed: 'The authorization code could not be exchanged.',
  userinfo_request_failed: 'Google profile information could not be retrieved.',
};

function GoogleOAuthTestContent() {
  const shouldConsumeResult =
    new URLSearchParams(window.location.search).get('oauth') === 'complete';
  const [pageState, setPageState] = useState<PageState>(() =>
    shouldConsumeResult ? { status: 'loading' } : { status: 'idle' },
  );

  useEffect(() => {
    if (!shouldConsumeResult) {
      return;
    }

    let active = true;

    void consumeGoogleOAuthResult()
      .then((result) => {
        if (active) {
          setPageState({ status: 'result', result });
        }
      })
      .catch(() => {
        if (active) {
          setPageState({ status: 'request_error' });
        }
      });

    return () => {
      active = false;
    };
  }, [shouldConsumeResult]);

  return (
    <main className="testbed-page google-oauth-test-page">
      <header className="testbed-header">
        <a href="/testbed">← 테스트베드 목록</a>
        <h1>Google OAuth Test</h1>
        <p>Development-only backend OAuth flow verification.</p>
      </header>

      <section className="google-oauth-test-card">
        <button
          className="google-oauth-test-login"
          type="button"
          disabled={pageState.status === 'loading'}
          onClick={startGoogleOAuth}
        >
          Login with Google
        </button>

        <OAuthResultView pageState={pageState} />
      </section>
    </main>
  );
}

function OAuthResultView({ pageState }: { pageState: PageState }) {
  if (pageState.status === 'idle') {
    return <p role="status">Idle — no OAuth result requested.</p>;
  }

  if (pageState.status === 'loading') {
    return <p role="status">Loading OAuth result…</p>;
  }

  if (pageState.status === 'request_error') {
    return (
      <section className="google-oauth-test-result" data-status="error">
        <h2>Result request failed</h2>
        <p>The sanitized OAuth result could not be read.</p>
      </section>
    );
  }

  const { result } = pageState;

  if (result.status === 'success') {
    return (
      <section className="google-oauth-test-result" data-status="success">
        <h2>Success</h2>
        <dl>
          <dt>ID</dt>
          <dd>{result.user.id}</dd>
          <dt>Email</dt>
          <dd>{result.user.email}</dd>
          <dt>Email verified</dt>
          <dd>{result.user.emailVerified ? 'Yes' : 'No'}</dd>
          {result.user.name && (
            <>
              <dt>Name</dt>
              <dd>{result.user.name}</dd>
            </>
          )}
          {result.user.pictureUrl && (
            <>
              <dt>Picture URL</dt>
              <dd>{result.user.pictureUrl}</dd>
            </>
          )}
        </dl>
      </section>
    );
  }

  if (result.status === 'error') {
    return (
      <section className="google-oauth-test-result" data-status="error">
        <h2>OAuth failed</h2>
        <p>{errorMessages[result.error]}</p>
        <p>
          <code>{result.error}</code>
        </p>
      </section>
    );
  }

  if (result.status === 'unavailable') {
    return (
      <section className="google-oauth-test-result" data-status="unavailable">
        <h2>OAuth unavailable</h2>
        <p>The backend Google OAuth configuration is unavailable.</p>
      </section>
    );
  }

  return (
    <section className="google-oauth-test-result" data-status="missing">
      <h2>Result missing</h2>
      <p>The one-time OAuth result is missing or has expired.</p>
    </section>
  );
}

export default class GoogleOAuthTestPage extends Component {
  public render() {
    return <GoogleOAuthTestContent />;
  }
}
