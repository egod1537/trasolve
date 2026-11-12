import { useEffect, useState } from 'react';
import {
  LEGAL_PATHS,
  LEGAL_VERSIONS,
  type AuthConsentStatus,
} from '@trasolve/shared';
import { fetchConsentStatus } from '@/features/auth';
import { NL, useL } from '@/shared/i18n';
import { LegalLinks } from '@/shared/ui/LegalLinks';
import { LanguageControl } from '@/shared/i18n';
import './legal.css';
import { withMobileLayout } from '@/shared/config/mobileLayout';

function TermsDocument() {
  const L = useL();
  const sections = [
    [
      L('legal:v20261112.terms.serviceTitle'),
      L('legal:v20261112.terms.service'),
    ],
    [
      L('legal:v20261112.terms.accountTitle'),
      L('legal:v20261112.terms.account'),
    ],
    [
      L('legal:v20261112.terms.contentTitle'),
      L('legal:v20261112.terms.content'),
    ],
    [
      L('legal:v20261112.terms.accuracyTitle'),
      L('legal:v20261112.terms.accuracy'),
    ],
    [
      L('legal:v20261112.terms.paymentTitle'),
      L('legal:v20261112.terms.payment'),
    ],
    [
      L('legal:v20261112.terms.changesTitle'),
      L('legal:v20261112.terms.changes'),
    ],
  ];
  return sections.map(([title, text]) => (
    <section key={title}>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  ));
}

function PrivacyDocument() {
  const L = useL();
  const sections = [
    [
      L('legal:v20261112.privacy.collectionTitle'),
      L('legal:v20261112.privacy.collection'),
    ],
    [
      L('legal:v20261112.privacy.serviceDataTitle'),
      L('legal:v20261112.privacy.serviceData'),
    ],
    [
      L('legal:v20261112.privacy.purposeTitle'),
      L('legal:v20261112.privacy.purpose'),
    ],
    [
      L('legal:v20261112.privacy.retentionTitle'),
      L('legal:v20261112.privacy.retention'),
    ],
    [
      L('legal:v20261112.privacy.providersTitle'),
      L('legal:v20261112.privacy.providers'),
    ],
    [
      L('legal:v20261112.privacy.cookiesTitle'),
      L('legal:v20261112.privacy.cookies'),
    ],
    [
      L('legal:v20261112.privacy.rightsTitle'),
      L('legal:v20261112.privacy.rights'),
    ],
    [
      L('legal:v20261112.privacy.securityTitle'),
      L('legal:v20261112.privacy.security'),
    ],
  ];
  return sections.map(([title, text]) => (
    <section key={title}>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  ));
}

export default function LegalPage() {
  const L = useL();
  const privacy =
    window.location.pathname.replace(/\/$/, '') === LEGAL_PATHS.privacy;
  const version = privacy ? LEGAL_VERSIONS.privacy : LEGAL_VERSIONS.terms;
  const requestedVersion = new URLSearchParams(window.location.search).get(
    'version',
  );
  const [metadata, setMetadata] = useState<AuthConsentStatus | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetchConsentStatus(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setMetadata(value);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return (
    <main className="legal-page">
      <header className="legal-header">
        <a href={withMobileLayout('/')}>{NL('Trasolve')}</a>
        <LanguageControl />
      </header>
      <article>
        <h1>{privacy ? L('legal:privacyTitle') : L('legal:termsTitle')}</h1>
        <p className="legal-version">{L('legal:version', { version })}</p>
        {requestedVersion && requestedVersion !== version ? (
          <p role="alert">{L('legal:unknownVersion')}</p>
        ) : (
          <>
            <p>
              {L('legal:operator', {
                name: metadata?.operatorName ?? L('legal:operatorTeam'),
              })}
            </p>
            {privacy ? <PrivacyDocument /> : <TermsDocument />}
            <section>
              <h2>{L('legal:contactTitle')}</h2>
              <p>{L('legal:contactDescription')}</p>
              <a
                href={
                  metadata?.contactEmail
                    ? `mailto:${metadata.contactEmail}`
                    : (metadata?.contactUrl ??
                      'https://github.com/egod1537/trasolve/issues')
                }
              >
                {metadata?.contactEmail ?? L('legal:contactLink')}
              </a>
              {!metadata?.contactEmail && (
                <p>{L('legal:publicContactWarning')}</p>
              )}
            </section>
          </>
        )}
      </article>
      <footer>
        <LegalLinks />
      </footer>
    </main>
  );
}
