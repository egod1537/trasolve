import { useEffect, useRef, useState } from 'react';
import {
  LEGAL_VERSIONS,
  type AuthConsentAcceptance,
  type AuthConsentStatus,
} from '@trasolve/shared';
import {
  acceptConsent,
  cancelConsent,
  ConsentRequestError,
  fetchConsentStatus,
} from '../api/consent';
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
  const [failureCode, setFailureCode] = useState<
    'network' | 'expired' | 'version' | null
  >(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetchConsentStatus(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        setStatus(result);
        if (result.status === 'accepted') {
          window.location.replace(result.returnTo);
        } else if (result.status === 'signed-out') {
          setFailureCode('expired');
        } else if (
          result.versions.terms !== LEGAL_VERSIONS.terms ||
          result.versions.privacy !== LEGAL_VERSIONS.privacy
        ) {
          setFailureCode('version');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailureCode('network');
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
    setFailureCode(null);
    try {
      const result = await acceptConsent(acceptance, status.returnTo);
      rememberLastLoginProvider(result.user.loginProvider);
      window.location.replace(result.returnTo);
    } catch (cause) {
      setFailureCode(
        cause instanceof ConsentRequestError && cause.status === 409
          ? 'version'
          : cause instanceof ConsentRequestError && cause.status === 401
            ? 'expired'
            : 'network',
      );
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
    try {
      await cancelConsent();
      window.location.replace(withMobileLayout('/'));
    } catch {
      setFailureCode('network');
      inFlight.current = false;
      setBusy(false);
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
        {failureCode && (
          <p className="consent-error" role="alert">
            {failureCode === 'expired'
              ? L('legal:consent.expired')
              : failureCode === 'version'
                ? L('legal:consent.versionChanged')
                : L('legal:consent.error')}
          </p>
        )}
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
