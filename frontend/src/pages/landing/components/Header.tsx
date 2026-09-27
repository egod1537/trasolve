import { buildInfo, isBuildMetadataVisible } from '@/shared/config/buildInfo';
import { ThemeControl } from '@/shared/theme/ThemeControl';
import { LanguageControl, NL, useL } from '@/shared/i18n';

export function Header() {
  const L = useL();
  const showBuildMetadata =
    isBuildMetadataVisible(buildInfo.channel) &&
    Boolean(buildInfo.branch || buildInfo.sha);
  const shortSha = buildInfo.sha.slice(0, 7);

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
        <div className="header-actions">
          <LanguageControl />
          <ThemeControl />
          <a className="button button-small button-outline" href="/map">
            {L('common:header.text.goServices')}
          </a>
        </div>
      </nav>
    </header>
  );
}
