import { useEffect, useRef, useState } from 'react';
import {
  LEGAL_VERSIONS,
  type AuthConsentAcceptance,
  type AuthConsentStatus,
} from '@trasolve/shared';
import {
  acceptConsent,
  cancelConsent,
  fetchConsentStatus,
} from '../api/consent';
import {
  classifyConsentFailure,
  type ConsentFailure,
} from '../model/consentFailure';
import { ConsentForm } from './ConsentForm';
import { rememberLastLoginProvider } from '../model/lastLoginProvider';
import { NL, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { LegalLinks } from '@/shared/ui/LegalLinks';
import { withMobileLayout } from '@/shared/config/mobileLayout';
import './consent.css';

export function ConsentPage() {
  const L = useL();
  const [status, setStatus] = useState<AuthConsentStatus | null>(null);
  const [failure, setFailure] = useState<ConsentFailure | null>(null);
  const failureCode = failure?.kind;
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const statusRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    statusRequest.current = controller;
    void fetchConsentStatus(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        setStatus(result);
        if (result.status === 'accepted') {
          window.location.replace(result.returnTo);
        } else if (result.status === 'signed-out') {
          setFailure({ kind: 'expired', status: null });
        } else if (
          result.versions.terms !== LEGAL_VERSIONS.terms ||
          result.versions.privacy !== LEGAL_VERSIONS.privacy
        ) {
          setFailure({ kind: 'version', status: null });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(classifyConsentFailure(cause));
        }
      });
    return () => controller.abort();
  }, []);
  const accept = async (acceptance: AuthConsentAcceptance) => {
    if (inFlight.current || !status) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const result = await acceptConsent(acceptance, status.returnTo);
      rememberLastLoginProvider(result.user.loginProvider);
      window.location.replace(result.returnTo);
    } catch (cause) {
      setFailure(classifyConsentFailure(cause));
      inFlight.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setBusy(true);
    statusRequest.current?.abort();
    try {
      await cancelConsent();
    } catch {
      // Leaving the public consent page must remain possible during an outage.
      // The backend still requires consent before granting account access.
    } finally {
      window.location.replace(withMobileLayout('/'));
    }
  };
  return (
    <main className="consent-page">
      <section
        className="consent-card"
        aria-labelledby="consent-title"
        aria-busy={busy}
      >
        <button
          className="consent-brand"
          type="button"
          disabled={busy}
          onClick={() => {
            void cancel();
          }}
        >
          {NL('Trasolve')}
        </button>
        <h1 id="consent-title">{L('legal:consent.title')}</h1>
        <p>{L('legal:consent.description')}</p>
        {failure && <ConsentFailureNotice failure={failure} />}
        {status?.status === 'required' &&
        failureCode !== 'expired' &&
        failureCode !== 'version' ? (
          <ConsentForm
            provider={status.provider}
            busy={busy}
            onAccept={(value) => {
              void accept(value);
            }}
            onCancel={() => {
              void cancel();
            }}
          />
        ) : (
          <div className="consent-fallback">
            {!status && !failureCode && (
              <p role="status">{L('common:routes.loadingLabel.pageLoading')}</p>
            )}
            {failureCode && (
              <>
                <Button onClick={() => window.location.reload()}>
                  {L('legal:consent.retry')}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => {
                    void cancel();
                  }}
                >
                  {L('legal:consent.back')}
                </Button>
              </>
            )}
            <LegalLinks newTab />
          </div>
        )}
      </section>
    </main>
  );
}

/** Uses existing translations; HTTP status distinguishes server failures. */
export function ConsentFailureNotice({ failure }: { failure: ConsentFailure }) {
  const L = useL();
  return (
    <p className="consent-error" role="alert" data-error-kind={failure.kind}>
      {failure.kind === 'expired'
        ? L('legal:consent.expired')
        : failure.kind === 'version'
          ? L('legal:consent.versionChanged')
          : failure.kind === 'network'
            ? L('legal:consent.error')
            : L('common:status.error')}
      {failure.status !== null && (
        <>
          {' '}
          <code>
            {NL('HTTP')} {failure.status}
          </code>
        </>
      )}
    </p>
  );
}
