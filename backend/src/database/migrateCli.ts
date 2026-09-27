import { loadBackendEnvironment } from '../configuration/environment.js';
import { Database } from './database.js';
import { runMigrations } from './migrate.js';

loadBackendEnvironment();

const database = Database.fromEnvironment();

try {
  const result = await runMigrations(database);
  console.log(
    `Database migrations complete: ${result.applied.length} applied, ${result.skipped.length} already current.`,
  );
} finally {
  await database.close();
}
