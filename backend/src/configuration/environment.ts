import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

const localEnvPath = fileURLToPath(
  new URL('../../.env.local', import.meta.url),
);
let isEnvironmentLoaded = false;

export function loadBackendEnvironment(): void {
  if (isEnvironmentLoaded) {
    return;
  }
  isEnvironmentLoaded = true;

  if (existsSync(localEnvPath)) {
    loadEnvFile(localEnvPath);
  }
}
