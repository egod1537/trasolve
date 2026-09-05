import { buildInfo, isBuildMetadataVisible } from '../../buildInfo';

export function Header() {
  const showBuildMetadata =
    isBuildMetadataVisible(buildInfo.channel) &&
    Boolean(buildInfo.branch || buildInfo.sha);
  const shortSha = buildInfo.sha.slice(0, 7);

  return (
    <header className="site-header">
      <nav className="header-inner" aria-label="주요 메뉴">
        <div className="header-brand">
          <a className="brand" href="#top" aria-label="Trasolve 홈">
            <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
              <path d="M8 12.5 20 5l12 7.5v15L20 35 8 27.5z" />
              <path d="m13.5 21 4 4 9-10" />
            </svg>
            <span>Trasolve</span>
          </a>
          {showBuildMetadata && (
            <span className="build-metadata" aria-label="빌드 정보">
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
                  aria-label={`빌드 커밋 ${buildInfo.sha} (새 탭)`}
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
        <a className="button button-small button-outline" href="/map">
          서비스로 이동
        </a>
      </nav>
    </header>
  );
}
