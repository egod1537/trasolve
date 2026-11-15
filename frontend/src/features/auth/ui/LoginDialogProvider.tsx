import { useCallback, useId, useState, type ReactNode } from 'react';
import { API_ROUTES } from '@trasolve/shared';
import { LoginDialogContext } from '@/features/auth/model/loginDialogContext';
import {
  readLastLoginProvider,
  type LoginProvider,
} from '@/features/auth/model/lastLoginProvider';
import { LoginProviderButton } from './LoginProviderButton';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { LegalLinks } from '@/shared/ui/LegalLinks';
import { NL, useL } from '@/shared/i18n';
import '@/features/auth/ui/login-dialog.css';

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const L = useL();
  const titleId = useId();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recentProvider, setRecentProvider] = useState<LoginProvider | null>(
    null,
  );
  const open = useCallback((destination: string, link = false) => {
    setLinking(link);
    setBusy(false);
    setRecentProvider(readLastLoginProvider());
    setReturnTo(destination);
  }, []);
  const close = useCallback(() => {
    setReturnTo(null);
    setBusy(false);
  }, []);
  const start = (provider: 'google' | 'ssu') => {
    if (returnTo === null || busy) {
      return;
    }
    setBusy(true);
    const url = new URL(
      provider === 'google'
        ? API_ROUTES.googleOAuthStart
        : API_ROUTES.ssuSsoStart,
      window.location.origin,
    );
    url.searchParams.set('returnTo', returnTo);
    if (linking) {
      url.searchParams.set('intent', 'link');
    }
    window.location.assign(url.toString());
  };
  return (
    <LoginDialogContext.Provider value={open}>
      {children}
      {returnTo !== null && (
        <Dialog
          className="login-dialog"
          backdropClassName="login-dialog-backdrop"
          labelledBy={titleId}
          onClose={close}
          busy={busy}
        >
          <header className="login-dialog-header">
            <span className="login-dialog-brand">{NL('Trasolve')}</span>
            <IconButton
              variant="ghost"
              size="sm"
              icon={<CloseIcon />}
              aria-label={L('common:action.close')}
              onClick={close}
            />
          </header>
          <h2 id={titleId}>
            {linking
              ? L('auth:accountSettingsModal.label.loginMethod')
              : L('common:landing.navigation.signIn')}
          </h2>
          <p>
            {linking
              ? L('common:action.add')
              : L('auth:accountSettingsModal.label.loginMethod')}
          </p>
          <div className="login-dialog-providers">
            <LoginProviderButton
              provider="google"
              recent={!linking && recentProvider === 'google'}
              disabled={busy}
              onSelect={start}
            />
            <LoginProviderButton
              provider="ssu"
              recent={!linking && recentProvider === 'ssu'}
              disabled={busy}
              onSelect={start}
            />
          </div>
          <p className="login-legal-notice">{L('legal:loginNotice')}</p>
          <LegalLinks newTab />
        </Dialog>
      )}
    </LoginDialogContext.Provider>
  );
}
