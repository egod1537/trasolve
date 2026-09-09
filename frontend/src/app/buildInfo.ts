export type BuildChannel = 'local' | 'preview' | 'production';

export interface BuildInfo {
  channel: BuildChannel;
  branch: string;
  sha: string;
  repositoryUrl: string;
}

function readBuildChannel(value: string | undefined): BuildChannel {
  if (value === 'local' || value === 'preview' || value === 'production') {
    return value;
  }

  return 'local';
}

export const buildInfo: BuildInfo = {
  channel: readBuildChannel(import.meta.env.VITE_BUILD_CHANNEL),
  branch: import.meta.env.VITE_GIT_BRANCH?.trim() ?? '',
  sha: import.meta.env.VITE_GIT_SHA?.trim() ?? '',
  repositoryUrl:
    import.meta.env.VITE_GIT_REPOSITORY_URL?.trim().replace(/\/+$/, '') ?? '',
};

export function isBuildMetadataVisible(channel: BuildChannel) {
  return channel === 'local' || channel === 'preview';
}
