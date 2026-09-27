import { Component, useEffect, useState } from 'react';
import type { GoogleOAuthResult } from '@trasolve/shared';
import { consumeGoogleOAuthResult, startGoogleOAuth } from '@/features/auth';
import '@/pages/testbed/styles/testbed.css';
import '@/pages/testbed/styles/google-oauth-test.css';
import { useL, type Localize } from '@/shared/i18n';

type OAuthErrorCode = Extract<GoogleOAuthResult, { status: 'error' }>['error'];

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; result: GoogleOAuthResult }
  | { status: 'request_error' };

function getOAuthErrorMessage(code: OAuthErrorCode, L: Localize): string {
  switch (code) {
    case 'access_denied':
      return L(
        'auth:useCurrentUser.oauthErrorMessages.text.googleSignHasBeenCanceled',
      );
    case 'provider_error':
      return L(
        'auth:useCurrentUser.oauthErrorMessages.text.googleWasUnableCompleteSignRequest',
      );
    case 'invalid_callback':
      return L(
        'auth:useCurrentUser.oauthErrorMessages.text.loginRequestHasExpiredInvalidTry',
      );
    case 'token_exchange_failed':
      return L(
        'auth:useCurrentUser.oauthErrorMessages.text.failedProcessVerificationCodeTryAgain',
      );
    case 'userinfo_request_failed':
      return L(
        'auth:useCurrentUser.oauthErrorMessages.text.failedRetrieveGoogleProfileInformation',
      );
  }
}

function GoogleOAuthTestContent() {
  const L = useL();
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
        <a href="/testbed">
          {L('testbed:aiChatTestPage.aiChatTestContent.text.testbedList')}
        </a>
        <h1>
          {L(
            'testbed:googleOAuthTestPage.googleOAuthTestContent.title.googleOauthTest',
          )}
        </h1>
        <p>
          {L(
            'testbed:googleOAuthTestPage.googleOAuthTestContent.description.developmentOnlyBackendOauthFlowVerification',
          )}
        </p>
      </header>

      <section className="google-oauth-test-card">
        <button
          className="google-oauth-test-login"
          type="button"
          disabled={pageState.status === 'loading'}
          onClick={() => startGoogleOAuth('/testbed/google-oauth')}
        >
          {L(
            'testbed:googleOAuthTestPage.googleOAuthTestContent.action.loginGoogle',
          )}
        </button>

        <OAuthResultView pageState={pageState} />
      </section>
    </main>
  );
}

function OAuthResultView({ pageState }: { pageState: PageState }) {
  const L = useL();
  if (pageState.status === 'idle') {
    return (
      <p role="status">
        {L(
          'testbed:googleOAuthTestPage.oAuthResultView.description.idleNoOauthResultRequested',
        )}
      </p>
    );
  }

  if (pageState.status === 'loading') {
    return (
      <p role="status">
        {L(
          'testbed:googleOAuthTestPage.oAuthResultView.description.loadingOauthResult',
        )}
      </p>
    );
  }

  if (pageState.status === 'request_error') {
    return (
      <section className="google-oauth-test-result" data-status="error">
        <h2>
          {L(
            'testbed:googleOAuthTestPage.oAuthResultView.title.resultRequestFailed',
          )}
        </h2>
        <p>
          {L(
            'testbed:googleOAuthTestPage.oAuthResultView.description.sanitizedOauthResultCouldNotBe',
          )}
        </p>
      </section>
    );
  }

  const { result } = pageState;

  if (result.status === 'success') {
    return (
      <section className="google-oauth-test-result" data-status="success">
        <h2>
          {L('testbed:googleOAuthTestPage.oAuthResultView.status.success')}
        </h2>
        <dl>
          <dt>
            {L('testbed:jobBuilderLocationList.jobBuilderLocationItem.text.id')}
          </dt>
          <dd>{result.user.id}</dd>
          <dt>
            {L('testbed:googleOAuthTestPage.oAuthResultView.label.email')}
          </dt>
          <dd>{result.user.email}</dd>
          <dt>
            {L(
              'testbed:googleOAuthTestPage.oAuthResultView.label.emailVerified',
            )}
          </dt>
          <dd>
            {result.user.emailVerified
              ? L('testbed:googleOAuthTestPage.oAuthResultView.text.yes')
              : L('testbed:googleOAuthTestPage.oAuthResultView.text.no')}
          </dd>
          {result.user.name && (
            <>
              <dt>
                {L('testbed:googleOAuthTestPage.oAuthResultView.label.name')}
              </dt>
              <dd>{result.user.name}</dd>
            </>
          )}
          {result.user.pictureUrl && (
            <>
              <dt>
                {L(
                  'testbed:googleOAuthTestPage.oAuthResultView.label.pictureUrl',
                )}
              </dt>
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
        <h2>
          {L('testbed:googleOAuthTestPage.oAuthResultView.title.oauthFailed')}
        </h2>
        <p>{getOAuthErrorMessage(result.error, L)}</p>
        <p>
          <code>{result.error}</code>
        </p>
      </section>
    );
  }

  if (result.status === 'unavailable') {
    return (
      <section className="google-oauth-test-result" data-status="unavailable">
        <h2>
          {L(
            'testbed:googleOAuthTestPage.oAuthResultView.title.oauthUnavailable',
          )}
        </h2>
        <p>
          {L(
            'testbed:googleOAuthTestPage.oAuthResultView.description.backendGoogleOauthConfigurationUnavailable',
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="google-oauth-test-result" data-status="missing">
      <h2>
        {L('testbed:googleOAuthTestPage.oAuthResultView.title.resultMissing')}
      </h2>
      <p>
        {L(
          'testbed:googleOAuthTestPage.oAuthResultView.description.oneTimeOauthResultMissingHas',
        )}
      </p>
    </section>
  );
}

export default class GoogleOAuthTestPage extends Component {
  public render() {
    return <GoogleOAuthTestContent />;
  }
}
