import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const frontendDir = fileURLToPath(new URL('.', import.meta.url));
const defaultRepositoryUrl = 'https://github.com/egod1537/trasolve';
type BuildChannel = 'local' | 'preview' | 'production';

function readGitValue(args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd: frontendDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
  } catch {
    return '';
  }
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmedValue = value?.trim();
    if (trimmedValue) return trimmedValue;
  }

  return '';
}

function readGitBranch() {
  const branch = readGitValue(['rev-parse', '--abbrev-ref', 'HEAD']);
  return branch === 'HEAD' ? '' : branch;
}

function parseBuildChannel(value: string): BuildChannel | undefined {
  if (value === 'local' || value === 'preview' || value === 'production') {
    return value;
  }

  return undefined;
}

const proxy = {
  '/api': 'http://127.0.0.1:3000',
};

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, frontendDir, ['VITE_', 'JJS_']);
  const branch = firstNonEmpty(
    env.VITE_GIT_BRANCH,
    process.env.GITHUB_HEAD_REF,
    process.env.GITHUB_REF_NAME,
    process.env.CI_COMMIT_REF_NAME,
    env.JJS_GIT_BRANCH,
    env.JJS_BRANCH,
    readGitBranch(),
  );
  const configuredChannel = parseBuildChannel(
    env.VITE_BUILD_CHANNEL?.trim() ?? '',
  );
  const channel: BuildChannel =
    configuredChannel ??
    (command === 'serve' && !isPreview
      ? 'local'
      : branch
        ? branch === 'main'
          ? 'production'
          : 'preview'
        : 'local');
  const gitSha = firstNonEmpty(
    env.VITE_GIT_SHA,
    process.env.GITHUB_SHA,
    process.env.CI_COMMIT_SHA,
    env.JJS_COMMIT_SHA,
    readGitValue(['rev-parse', 'HEAD']),
  );
  const githubRepository = firstNonEmpty(
    process.env.GITHUB_REPOSITORY,
    env.JJS_GITHUB_REPOSITORY,
  );
  const repositoryUrl = firstNonEmpty(
    env.VITE_GIT_REPOSITORY_URL,
    githubRepository ? `https://github.com/${githubRepository}` : undefined,
    defaultRepositoryUrl,
  );

  return {
    plugins: [react()],
    // Keep one client-facing metadata interface, including local Git fallbacks.
    define: {
      'import.meta.env.VITE_BUILD_CHANNEL': JSON.stringify(channel),
      'import.meta.env.VITE_GIT_BRANCH': JSON.stringify(branch),
      'import.meta.env.VITE_GIT_SHA': JSON.stringify(gitSha),
      'import.meta.env.VITE_GIT_REPOSITORY_URL': JSON.stringify(repositoryUrl),
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
  };
});
