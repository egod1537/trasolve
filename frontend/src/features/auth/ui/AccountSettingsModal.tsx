import { useId } from 'react';
import type { GoogleOAuthUser } from '@trasolve/shared';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { StatusBadge } from '@/shared/ui/StatusBadge';
import '@/features/auth/ui/account-settings.css';

type Props = {
  user: GoogleOAuthUser;
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
        <h2 id={titleId}>계정 설정</h2>
        <IconButton
          className="account-settings-close"
          aria-label="계정 설정 닫기"
          title="닫기"
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
            {user.emailVerified ? '이메일 인증됨' : '이메일 미인증'}
          </StatusBadge>
        </div>
      </div>

      <dl className="account-settings-details">
        <dt>로그인 방식</dt>
        <dd>Google</dd>
        <dt>계정 ID</dt>
        <dd className="account-settings-id">{user.id}</dd>
      </dl>

      <p className="account-settings-note">
        이 계정 정보는 Google 로그인에서 가져오며, 이 앱에서 직접 수정할 수
        없습니다. 이름이나 프로필 사진을 바꾸려면 Google 계정에서 변경해 주세요.
      </p>

      <div className="account-settings-actions">
        <Button variant="danger" loading={loggingOut} onClick={onLogout}>
          {loggingOut ? '로그아웃 중…' : '로그아웃'}
        </Button>
      </div>
    </Dialog>
  );
}
