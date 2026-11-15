import { useId } from 'react';
import type { LoginProvider } from '@/features/auth/model/lastLoginProvider';
import { NL, useL } from '@/shared/i18n';

type Props = {
  provider: LoginProvider;
  recent: boolean;
  disabled: boolean;
  onSelect: (provider: LoginProvider) => void;
};

export function LoginProviderButton({
  provider,
  recent,
  disabled,
  onSelect,
}: Props) {
  const L = useL();
  const hintId = useId();
  return (
    <div className="login-provider">
      {recent && (
        <span id={hintId} className="login-provider-recent">
          {L('auth:loginDialog.recentAccount')}
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        aria-describedby={recent ? hintId : undefined}
        onClick={() => onSelect(provider)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d={
              provider === 'google'
                ? 'M20 12h-8m8 0a8 8 0 1 1-2.4-5.7'
                : 'm3 9 9-5 9 5-9 5-9-5Zm4 3v5c3 3 7 3 10 0v-5m4-3v8'
            }
          />
        </svg>
        {provider === 'google' ? NL('Google') : NL('숭실대학교 SSO')}
        <svg
          className="login-provider-arrow"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M5 12h14m-6-6 6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
