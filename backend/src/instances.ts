import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { Routes } from './google/maps/routes.js';

// Load configuration before constructing the shared instances, regardless of
// which backend module imports them first.
const localEnvPath = fileURLToPath(new URL('../.env.local', import.meta.url));
if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);

// Construct the shared route instance only here. Implementation modules must
// not import this module, which would create a circular dependency.
const routes = new Routes(process.env.GOOGLE_ROUTES_API_KEY ?? '');

export const API = {
  Route: routes,
};
