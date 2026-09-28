import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import '@/features/auth/ui/map-user-controls.css';
import { useCurrentUser } from '@/features/auth/model/useCurrentUser';
import { AccountSettingsModal } from '@/features/auth/ui/AccountSettingsModal';
import { PreferencesModal } from '@/features/preferences/ui/PreferencesModal';
import { useL } from '@/shared/i18n';

function initialOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </Icon>
  );
}

function MapPinIcon() {
  return (
    <Icon>
      <path d="M20.5 10c0 6-8.5 11-8.5 11s-8.5-5-8.5-11a8.5 8.5 0 0 1 17 0Z" />
      <circle cx="12" cy="10" r="2.75" />
    </Icon>
  );
}

function GearIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4.5a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4.5a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10a1.7 1.7 0 0 0 1.55 1h.09a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
    </Icon>
  );
}

function LogoutIcon() {
  return (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  );
}

function LoginIcon() {
  return (
    <Icon>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </Icon>
  );
}

function PersonIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
    </Icon>
  );
}

type Props = {
  onOpenTripPicker: () => void;
};

export function MapUserControls({ onOpenTripPicker }: Props) {
  const L = useL();
  const { state, login, logout, authNotice } = useCurrentUser();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const profileMenuId = useId();

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      setProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      window.location.assign('/');
    } finally {
      setLoggingOut(false);
      setProfileMenuOpen(false);
      setAccountSettingsOpen(false);
      setPreferencesOpen(false);
    }
  };

  const user = state.status === 'signed-in' ? state.user : null;
  const displayName = user ? (user.name ?? user.email) : null;
  const profileLabel = user
    ? L('auth:mapUserControls.text.profile', { displayName: displayName })
    : L('auth:mapUserControls.text.signGoogleAccount');

  return (
    <div
      ref={rootRef}
      className="map-user-controls"
      role="group"
      aria-label={L('auth:mapUserControls.ariaLabel.userMenu')}
    >
      <span className="map-user-control-anchor">
        <button
          type="button"
          className="map-profile-button"
          aria-label={profileLabel}
          title={profileLabel}
          aria-haspopup="menu"
          aria-expanded={profileMenuOpen}
          aria-controls={profileMenuOpen ? profileMenuId : undefined}
          disabled={state.status === 'loading'}
          data-open={profileMenuOpen}
          data-status={state.status}
          onClick={() => setProfileMenuOpen((current) => !current)}
        >
          {user ? (
            user.pictureUrl ? (
              <img
                className="map-profile-avatar-image"
                src={user.pictureUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              initialOf(displayName ?? '?')
            )
          ) : (
            <PersonIcon />
          )}
        </button>
        {profileMenuOpen && (
          <div
            id={profileMenuId}
            className="map-user-menu map-profile-menu"
            role="menu"
          >
            {state.status === 'signed-in' ? (
              <div className="map-profile-menu-header">
                <span className="map-profile-menu-avatar" aria-hidden="true">
                  {state.user.pictureUrl ? (
                    <img
                      src={state.user.pictureUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    initialOf(displayName ?? '?')
                  )}
                </span>
                <span className="map-profile-menu-identity">
                  <span className="map-profile-menu-name">{displayName}</span>
                  <span className="map-profile-menu-email">
                    {state.user.email}
                  </span>
                </span>
              </div>
            ) : authNotice ? (
              <p className="map-profile-menu-notice" role="alert">
                {authNotice}
              </p>
            ) : null}
            <a
              className="map-user-menu-item"
              role="menuitem"
              href="/"
              onClick={() => setProfileMenuOpen(false)}
            >
              <HomeIcon />
              <span>{L('auth:mapUserControls.text.goHome')}</span>
            </a>
            <button
              type="button"
              className="map-user-menu-item"
              role="menuitem"
              onClick={() => {
                setProfileMenuOpen(false);
                onOpenTripPicker();
              }}
            >
              <MapPinIcon />
              <span>{L('auth:mapUserControls.text.myTravelMap')}</span>
            </button>
            <button
              type="button"
              className="map-user-menu-item"
              role="menuitem"
              onClick={() => {
                setProfileMenuOpen(false);
                setPreferencesOpen(true);
              }}
            >
              <GearIcon />
              <span>{L('auth:mapUserControls.text.preferences')}</span>
            </button>
            <div className="map-user-menu-divider" role="separator" />
            {state.status === 'signed-in' ? (
              <>
                <button
                  type="button"
                  className="map-user-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    setAccountSettingsOpen(true);
                  }}
                >
                  <GearIcon />
                  <span>
                    {L('auth:accountSettingsModal.title.accountSettings')}
                  </span>
                </button>
                <button
                  type="button"
                  className="map-user-menu-item is-danger"
                  role="menuitem"
                  disabled={loggingOut}
                  onClick={() => void handleLogout()}
                >
                  <LogoutIcon />
                  <span>
                    {loggingOut
                      ? L('auth:accountSettingsModal.action.loggingOut')
                      : L('common:action.signOut')}
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="map-user-menu-item is-accent"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  void login();
                }}
              >
                <LoginIcon />
                <span>{L('auth:mapUserControls.text.signGoogle')}</span>
              </button>
            )}
          </div>
        )}
      </span>
      {accountSettingsOpen && state.status === 'signed-in' && (
        <AccountSettingsModal
          user={state.user}
          loggingOut={loggingOut}
          onClose={() => setAccountSettingsOpen(false)}
          onLogout={() => void handleLogout()}
        />
      )}
      {preferencesOpen && (
        <PreferencesModal onClose={() => setPreferencesOpen(false)} />
      )}
    </div>
  );
}
