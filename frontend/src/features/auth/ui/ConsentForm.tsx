import { useState, type FormEvent } from 'react';
import {
  LEGAL_VERSIONS,
  type AuthConsentAcceptance,
  type AuthConsentStatus,
} from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { LegalLinks } from '@/shared/ui/LegalLinks';

type Props = {
  provider: AuthConsentStatus['provider'];
  busy: boolean;
  onAccept: (acceptance: AuthConsentAcceptance) => void;
  onCancel: () => void;
};

export function ConsentForm({ provider, busy, onAccept, onCancel }: Props) {
  const L = useL();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [age, setAge] = useState(false);
  const [profile, setProfile] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy && terms && privacy && age) {
      onAccept({
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
        termsAccepted: true,
        privacyAccepted: true,
        ageConfirmed: true,
        profileAccepted: provider === 'google' && profile,
      });
    }
  };
  return (
    <form className="consent-form" onSubmit={submit}>
      <LegalLinks newTab />
      <fieldset disabled={busy}>
        <legend className="sr-only">{L('legal:consent.title')}</legend>
        <label className="consent-choice">
          <input
            type="checkbox"
            checked={age}
            onChange={(event) => setAge(event.target.checked)}
            required
          />
          <span>{L('legal:consent.age')}</span>
        </label>
        <label className="consent-choice">
          <input
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            required
          />
          <span>{L('legal:consent.terms')}</span>
        </label>
        <label className="consent-choice">
          <input
            type="checkbox"
            checked={privacy}
            onChange={(event) => setPrivacy(event.target.checked)}
            required
          />
          <span>{L('legal:consent.privacy')}</span>
        </label>
        <dl className="consent-summary">
          <dt>{L('legal:consent.purposeLabel')}</dt>
          <dd>{L('legal:consent.purpose')}</dd>
          <dt>{L('legal:consent.itemsLabel')}</dt>
          <dd>
            {provider === 'ssu'
              ? L('legal:consent.ssuItems')
              : L('legal:consent.googleItems')}
          </dd>
          <dt>{L('legal:consent.retentionLabel')}</dt>
          <dd>{L('legal:consent.retention')}</dd>
        </dl>
        {provider === 'google' && (
          <>
            <label className="consent-choice">
              <input
                type="checkbox"
                checked={profile}
                onChange={(event) => setProfile(event.target.checked)}
              />
              <span>{L('legal:consent.profile')}</span>
            </label>
            <p className="consent-hint">{L('legal:consent.profileDetail')}</p>
          </>
        )}
      </fieldset>
      <p className="consent-hint">{L('legal:consent.refusal')}</p>
      <div className="consent-actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {L('common:action.cancel')}
        </Button>
        <Button
          variant="primary"
          type="submit"
          loading={busy}
          disabled={!age || !terms || !privacy}
        >
          {L('legal:consent.submit')}
        </Button>
      </div>
    </form>
  );
}
