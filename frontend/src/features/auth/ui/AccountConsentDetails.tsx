import { useEffect, useState } from 'react';
import type { AuthConsentRecord } from '@trasolve/shared';
import { fetchConsentStatus } from '../api/consent';
import { getLanguage, useL } from '@/shared/i18n';
import { LegalLinks } from '@/shared/ui/LegalLinks';

export function AccountConsentDetails({ userId }: { userId: string }) {
  const L = useL();
  const [acceptance, setAcceptance] = useState<AuthConsentRecord | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetchConsentStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) {
          setAcceptance(status.acceptance);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [userId]);
  return (
    <div className="account-consent-details">
      <LegalLinks newTab />
      {acceptance && (
        <p>
          {L('legal:consent.receipt', {
            termsVersion: acceptance.termsVersion,
            privacyVersion: acceptance.privacyVersion,
            acceptedAt: new Intl.DateTimeFormat(getLanguage(), {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(acceptance.acceptedAt)),
          })}
        </p>
      )}
    </div>
  );
}
