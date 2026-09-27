import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ThemeControl } from '@/shared/theme/ThemeControl';
import '@/features/auth/ui/map-user-controls.css';
import { useCurrentUser } from '@/features/auth/model/useCurrentUser';
import { AccountSettingsModal } from '@/features/auth/ui/AccountSettingsModal';
import { PreferencesModal } from '@/features/preferences/ui/PreferencesModal';
import { LanguageControl, useL } from '@/shared/i18n';

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

function NineDotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {[5, 12, 19].flatMap((cy) =>
        [5, 12, 19].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.35" />
        )),
      )}
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

type OpenMenu = 'app' | 'profile' | null;

export function MapUserControls() {
  const L = useL();
  const { state, login, logout, authNotice } = useCurrentUser();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const appMenuId = useId();
  const profileMenuId = useId();

  useEffect(() => {
    if (!openMenu) {
      return;
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpenMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      setOpenMenu(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenu]);

  const toggleMenu = (menu: OpenMenu) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setOpenMenu(null);
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
      <LanguageControl className="map-language-control" />
      <ThemeControl className="map-theme-control" />
      <span className="map-user-control-anchor">
        <button
          type="button"
          className="map-app-menu-button"
          aria-label={L('auth:mapUserControls.ariaLabel.appMenu')}
          title={L('auth:mapUserControls.ariaLabel.appMenu')}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'app'}
          aria-controls={openMenu === 'app' ? appMenuId : undefined}
          data-open={openMenu === 'app'}
          onClick={() => toggleMenu('app')}
        >
          <NineDotIcon />
        </button>
        {openMenu === 'app' && (
          <div id={appMenuId} className="map-user-menu" role="menu">
            <a className="map-user-menu-item" role="menuitem" href="/">
              <HomeIcon />
              <span>{L('auth:mapUserControls.text.goHome')}</span>
            </a>
            <a className="map-user-menu-item" role="menuitem" href="/map">
              <MapPinIcon />
              <span>{L('auth:mapUserControls.text.myTravelMap')}</span>
            </a>
            <div className="map-user-menu-divider" role="separator" />
            <button
              type="button"
              className="map-user-menu-item"
              role="menuitem"
              onClick={() => {
                setOpenMenu(null);
                setPreferencesOpen(true);
              }}
            >
              <GearIcon />
              <span>{L('auth:mapUserControls.text.preferences')}</span>
            </button>
          </div>
        )}
      </span>
      <span className="map-user-control-anchor">
        <button
          type="button"
          className="map-profile-button"
          aria-label={profileLabel}
          title={profileLabel}
          aria-haspopup="menu"
          aria-expanded={openMenu === 'profile'}
          aria-controls={openMenu === 'profile' ? profileMenuId : undefined}
          disabled={state.status === 'loading'}
          data-open={openMenu === 'profile'}
          data-status={state.status}
          onClick={() => toggleMenu('profile')}
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
        {openMenu === 'profile' &&
          (state.status === 'signed-in' ? (
            <div
              id={profileMenuId}
              className="map-user-menu map-profile-menu"
              role="menu"
            >
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
              <button
                type="button"
                className="map-user-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
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
            </div>
          ) : (
            <div
              id={profileMenuId}
              className="map-user-menu map-profile-menu"
              role="menu"
            >
              {authNotice && (
                <p className="map-profile-menu-notice" role="alert">
                  {authNotice}
                </p>
              )}
              <button
                type="button"
                className="map-user-menu-item is-accent"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  login();
                }}
              >
                <LoginIcon />
                <span>{L('auth:mapUserControls.text.signGoogle')}</span>
              </button>
            </div>
          ))}
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
