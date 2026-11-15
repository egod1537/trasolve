import { useLoginDialog } from '@/features/auth/model/loginDialogContext';
import { useId } from 'react';
import type { AuthUser } from '@trasolve/shared';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import '@/features/auth/ui/account-settings.css';
import { NL, useL } from '@/shared/i18n';
import { AccountConsentDetails } from './AccountConsentDetails';

type Props = {
  user: AuthUser;
  loggingOut: boolean;
  onClose: () => void;
  onLogout: () => void;
};

export function AccountSettingsModal({
  user,
  loggingOut,
  onClose,
  onLogout,
}: Props) {
  const L = useL();
  const titleId = useId();
  const openLoginDialog = useLoginDialog();

  return (
    <Dialog
      className="account-settings-popup"
      backdropClassName="account-settings-backdrop"
      labelledBy={titleId}
      closeOnBackdrop={false}
      closeOnEscape={!loggingOut}
      onClose={onClose}
    >
      <header className="account-settings-header">
        <h2 id={titleId}>
          {L('auth:accountSettingsModal.title.accountSettings')}
        </h2>
        <IconButton
          className="account-settings-close"
          aria-label={L(
            'auth:accountSettingsModal.ariaLabel.closeAccountSettings',
          )}
          title={L('common:action.close')}
          variant="ghost"
          size="sm"
          icon={<CloseIcon />}
          onClick={onClose}
        />
      </header>

      <div className="account-settings-identity">
        {user.pictureUrl ? (
          <img
            className="account-settings-avatar-image"
            src={user.pictureUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="account-settings-avatar-fallback" aria-hidden="true">
            {(user.name ?? user.email ?? user.id)
              .trim()
              .slice(0, 1)
              .toUpperCase()}
          </span>
        )}
        <div className="account-settings-identity-text">
          <strong className="account-settings-name">
            {user.name ?? user.email ?? user.id}
          </strong>
          <span className="account-settings-email">{user.email}</span>
          {user.email && (
            <StatusBadge
              className="account-settings-badge"
              tone={user.emailVerified ? 'success' : 'danger'}
            >
              {user.emailVerified
                ? L('auth:accountSettingsModal.text.emailVerified')
                : L('auth:accountSettingsModal.text.emailNotVerified')}
            </StatusBadge>
          )}
        </div>
      </div>

      <dl className="account-settings-details">
        <dt>{L('auth:accountSettingsModal.label.loginMethod')}</dt>
        <dd className="account-settings-login-method">
          {user.loginProvider === 'ssu'
            ? NL('숭실대학교 SSO')
            : user.loginProvider === 'local'
              ? NL('Trasolve Debug')
              : NL('Google')}
          <Button
            size="sm"
            variant="secondary"
            disabled={loggingOut}
            onClick={() =>
              openLoginDialog(
                window.location.pathname + window.location.search,
                true,
              )
            }
          >
            {L('common:action.add')}
          </Button>
        </dd>
        <dt>{L('auth:accountSettingsModal.label.accountId')}</dt>
        <dd className="account-settings-id">{user.id}</dd>
      </dl>

      {(!user.loginProvider || user.loginProvider === 'google') && (
        <p className="account-settings-note">
          {L(
            'auth:accountSettingsModal.description.thisAccountInformationComesFromGoogle',
          )}
        </p>
      )}

      <div className="account-settings-actions">
        <Button variant="danger" loading={loggingOut} onClick={onLogout}>
          {loggingOut
            ? L('auth:accountSettingsModal.action.loggingOut')
            : L('common:action.signOut')}
        </Button>
      </div>
      <AccountConsentDetails userId={user.id} />
    </Dialog>
  );
}
