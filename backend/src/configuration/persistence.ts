import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export type BackendPersistenceMode = 'local' | 'postgres';

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

export function resolveBackendPersistenceMode(
  environment: NodeJS.ProcessEnv = process.env,
): BackendPersistenceMode {
  const configured =
    environment.TRASOLVE_PERSISTENCE_MODE?.trim().toLowerCase();
  if (configured === 'local' || configured === 'postgres') {
    return configured;
  }
  if (configured) {
    throw new Error(
      'TRASOLVE_PERSISTENCE_MODE must be either "local" or "postgres".',
    );
  }
  return environment.NODE_ENV === 'production' ? 'postgres' : 'local';
}

export function resolveBackendDataRoot(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  return resolve(
    repositoryRoot,
    environment.TRASOLVE_DATA_DIR?.trim() || '.local/trasolve',
  );
}
