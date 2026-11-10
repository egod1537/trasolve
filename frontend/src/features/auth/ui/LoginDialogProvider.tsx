import { useCallback, useId, useState, type ReactNode } from 'react';
import { API_ROUTES } from '@trasolve/shared';
import { LoginDialogContext } from '@/features/auth/model/loginDialogContext';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { NL, useL } from '@/shared/i18n';
import '@/features/auth/ui/login-dialog.css';

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const L = useL();
  const titleId = useId();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = useCallback((destination: string, link = false) => {
    setLinking(link);
    setBusy(false);
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
            <button
              type="button"
              disabled={busy}
              onClick={() => start('google')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 12h-8m8 0a8 8 0 1 1-2.4-5.7" />
              </svg>
              {NL('Google')}
              <svg
                className="login-provider-arrow"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
            <button type="button" disabled={busy} onClick={() => start('ssu')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m3 9 9-5 9 5-9 5-9-5Zm4 3v5c3 3 7 3 10 0v-5m4-3v8" />
              </svg>
              {NL('숭실대학교 SSO')}
              <svg
                className="login-provider-arrow"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </Dialog>
      )}
    </LoginDialogContext.Provider>
  );
}
