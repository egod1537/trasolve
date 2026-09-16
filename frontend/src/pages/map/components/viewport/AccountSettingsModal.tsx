import { useEffect, useRef, type ReactNode } from 'react';
import type { GoogleOAuthUser } from '@trasolve/shared';
import '../../styles/account-settings.css';

type Props = {
  user: GoogleOAuthUser;
  loggingOut: boolean;
  onClose: () => void;
  onLogout: () => void;
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

export function AccountSettingsModal({
  user,
  loggingOut,
  onClose,
  onLogout,
}: Props) {
  const popupRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement;
    popupRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <div className="account-settings-backdrop">
      <section
        ref={popupRef}
        className="account-settings-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="account-settings-header">
          <h2 id="account-settings-title">계정 설정</h2>
          <button
            type="button"
            className="account-settings-close"
            aria-label="계정 설정 닫기"
            title="닫기"
            onClick={onClose}
          >
            <Icon>
              <path d="m6 6 12 12M18 6 6 18" />
            </Icon>
          </button>
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
            <span
              className="account-settings-avatar-fallback"
              aria-hidden="true"
            >
              {(user.name ?? user.email).trim().slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="account-settings-identity-text">
            <strong className="account-settings-name">
              {user.name ?? user.email}
            </strong>
            <span className="account-settings-email">{user.email}</span>
            <span
              className={`account-settings-badge${user.emailVerified ? ' is-verified' : ''}`}
            >
              {user.emailVerified ? '이메일 인증됨' : '이메일 미인증'}
            </span>
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
          없습니다. 이름이나 프로필 사진을 바꾸려면 Google 계정에서 변경해
          주세요.
        </p>

        <div className="account-settings-actions">
          <button
            type="button"
            className="account-settings-logout"
            disabled={loggingOut}
            onClick={onLogout}
          >
            {loggingOut ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      </section>
    </div>
  );
}
