import { useId } from 'react';
import type { AuthUser } from '@trasolve/shared';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import '@/features/auth/ui/account-settings.css';
import { NL, useL } from '@/shared/i18n';

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
            {(user.name ?? user.email).trim().slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="account-settings-identity-text">
          <strong className="account-settings-name">
            {user.name ?? user.email}
          </strong>
          <span className="account-settings-email">{user.email}</span>
          <StatusBadge
            className="account-settings-badge"
            tone={user.emailVerified ? 'success' : 'danger'}
          >
            {user.emailVerified
              ? L('auth:accountSettingsModal.text.emailVerified')
              : L('auth:accountSettingsModal.text.emailNotVerified')}
          </StatusBadge>
        </div>
      </div>

      <dl className="account-settings-details">
        <dt>{L('auth:accountSettingsModal.label.loginMethod')}</dt>
        <dd>{NL('Google')}</dd>
        <dt>{L('auth:accountSettingsModal.label.accountId')}</dt>
        <dd className="account-settings-id">{user.id}</dd>
      </dl>

      <p className="account-settings-note">
        {L(
          'auth:accountSettingsModal.description.thisAccountInformationComesFromGoogle',
        )}
      </p>

      <div className="account-settings-actions">
        <Button variant="danger" loading={loggingOut} onClick={onLogout}>
          {loggingOut
            ? L('auth:accountSettingsModal.action.loggingOut')
            : L('common:action.signOut')}
        </Button>
      </div>
    </Dialog>
  );
}
