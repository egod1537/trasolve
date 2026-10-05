import { useEffect, useId, useRef, useState } from 'react';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import { buildInfo, isBuildMetadataVisible } from '@/shared/config/buildInfo';
import { NL, useL } from '@/shared/i18n';

type HeaderProfile = {
  displayName: string;
  pictureUrl?: string;
};

type Props = {
  actionLabel: string;
  actionDisabled: boolean;
  profile: HeaderProfile | null;
  onAction: () => void;
  onLogout: () => Promise<void>;
};

export function Header({
  actionLabel,
  actionDisabled,
  profile,
  onAction,
  onLogout,
}: Props) {
  const L = useL();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const profileMenuId = useId();
  const showBuildMetadata =
    isBuildMetadataVisible(buildInfo.channel) &&
    Boolean(buildInfo.branch || buildInfo.sha);
  const shortSha = buildInfo.sha.slice(0, 7);
  const profileLabel = profile
    ? L('auth:mapUserControls.text.profile', {
        displayName: profile.displayName,
      })
    : null;

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !actionsRef.current?.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setLoggingOut(false);
      setProfileMenuOpen(false);
    }
  };

  return (
    <header className="site-header">
      <nav
        className="header-inner"
        aria-label={L('common:header.ariaLabel.mainMenu')}
      >
        <div className="header-brand">
          <a
            className="brand"
            href="#top"
            aria-label={L('common:header.ariaLabel.trasolveHome')}
          >
            <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M8 12.5 20 5l12 7.5v15L20 35 8 27.5z" />
              <path d="m13.5 21 4 4 9-10" />
            </svg>
            <span>{NL('Trasolve')}</span>
          </a>
          {showBuildMetadata && (
            <span
              className="build-metadata"
              aria-label={L('common:header.ariaLabel.buildInformation')}
            >
              {buildInfo.branch && (
                <span className="build-branch" title={buildInfo.branch}>
                  {buildInfo.branch}
                </span>
              )}
              {buildInfo.branch && buildInfo.sha && (
                <span className="build-separator" aria-hidden="true">
                  ·
                </span>
              )}
              {buildInfo.sha && buildInfo.repositoryUrl ? (
                <a
                  className="build-commit"
                  href={`${buildInfo.repositoryUrl}/commit/${buildInfo.sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={buildInfo.sha}
                  aria-label={L('common:header.ariaLabel.buildCommitNewTab', {
                    sha: buildInfo.sha,
                  })}
                >
                  {shortSha}
                </a>
              ) : (
                buildInfo.sha && (
                  <span className="build-commit" title={buildInfo.sha}>
                    {shortSha}
                  </span>
                )
              )}
            </span>
          )}
        </div>
        <div ref={actionsRef} className="header-actions">
          {profile ? (
            <>
              <button
                type="button"
                className="header-profile-button"
                aria-label={profileLabel ?? undefined}
                title={profileLabel ?? undefined}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls={profileMenuOpen ? profileMenuId : undefined}
                aria-busy={loggingOut}
                disabled={loggingOut}
                onClick={() => setProfileMenuOpen((current) => !current)}
              >
                {profile.pictureUrl ? (
                  <img
                    src={profile.pictureUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  profile.displayName.trim().slice(0, 1).toUpperCase() || '?'
                )}
              </button>
              {profileMenuOpen && (
                <div
                  id={profileMenuId}
                  className="header-profile-menu"
                  role="menu"
                >
                  <button
                    type="button"
                    className="header-profile-menu-item"
                    data-analytics-id={ANALYTICS_TARGETS.landingEnterMap}
                    data-analytics-screen={ANALYTICS_SCREENS.landing}
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onAction();
                    }}
                  >
                    {L('common:header.text.goServices')}
                  </button>
                  <div
                    className="header-profile-menu-divider"
                    role="separator"
                  />
                  <button
                    type="button"
                    className="header-profile-menu-item is-danger"
                    role="menuitem"
                    disabled={loggingOut}
                    onClick={() => void handleLogout()}
                  >
                    {loggingOut
                      ? L('auth:accountSettingsModal.action.loggingOut')
                      : L('common:action.signOut')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              className="button button-small button-outline"
              data-analytics-id={ANALYTICS_TARGETS.landingLogin}
              data-analytics-screen={ANALYTICS_SCREENS.landing}
              disabled={actionDisabled}
              aria-busy={actionDisabled}
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
