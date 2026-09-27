import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBackendEnvironment } from '../../configuration/environment.js';
import { Database } from '../../database/database.js';
import {
  migrateLegacyTrips,
  type LegacyTripMigrationOptions,
} from './migrateLegacyTrips.js';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const usage = `Usage:
  npm run trip:migrate -- \\
    --source-owner <legacy-user-id> \\
    --destination-owner <internal-users-uuid> \\
    --backup-dir <new-backup-directory> \\
    --confirm-writer-stopped [--report <new-report-file>]

Dry run (validates source, owner and duplicate IDs; writes no Trip rows):
  npm run trip:migrate -- \\
    --source-owner <legacy-user-id> \\
    --destination-owner <internal-users-uuid> \\
    --dry-run [--report <new-report-file>]

Options:
  --source-root <directory>       Defaults to TRASOLVE_DATA_DIR or .local/trasolve.
  --source-owner <id>             Required legacy file owner directory and userId.
  --destination-owner <uuid>      Required explicit trasolve.users.id mapping.
  --backup-dir <directory>        Required, new directory for a real migration.
  --confirm-writer-stopped        Required for a real migration.
  --report <file>                 Must not already exist.
  --dry-run                       Validate and preflight without backup or inserts.
  --help                          Show this help.`;

loadBackendEnvironment();

void main().catch((cause: unknown) => {
  console.error(`Trip migration failed: ${formatError(cause)}`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  if (process.argv.slice(2).includes('--help')) {
    console.log(usage);
    return;
  }
  const options = parseArguments(process.argv.slice(2));
  const database = Database.fromEnvironment();
  try {
    const report = await migrateLegacyTrips(database, options);
    const normalizationChangedCount = report.trips.filter(
      (trip) => trip.normalizationChanged,
    ).length;
    console.log(
      JSON.stringify(
        {
          status: report.status,
          sourceOwnerUserId: report.source.ownerUserId,
          destinationOwnerUserId: report.destination.ownerUserId,
          sourceTripCount: report.source.tripCount,
          insertedTripCount: report.destination.insertedTripCount,
          verifiedTripCount: report.destination.verifiedTripCount,
          normalizationChangedCount,
          ignoredEntries: report.source.ignoredEntries,
          backupDirectory: report.backup?.directory ?? null,
          reportPath:
            options.reportPath ??
            (report.backup
              ? resolve(report.backup.directory, 'migration-report.json')
              : null),
        },
        null,
        2,
      ),
    );
  } finally {
    await database.close();
  }
}

function parseArguments(
  arguments_: readonly string[],
): LegacyTripMigrationOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  const valueOptions = new Set([
    '--source-root',
    '--source-owner',
    '--destination-owner',
    '--backup-dir',
    '--report',
  ]);
  const flagOptions = new Set(['--dry-run', '--confirm-writer-stopped']);

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (flagOptions.has(argument)) {
      if (flags.has(argument)) {
        throw new Error(`Duplicate option ${argument}.`);
      }
      flags.add(argument);
      continue;
    }
    if (!valueOptions.has(argument)) {
      throw new Error(`Unknown option ${argument}.\n\n${usage}`);
    }
    if (values.has(argument)) {
      throw new Error(`Duplicate option ${argument}.`);
    }
    const value = arguments_[index + 1]?.trim();
    if (!value || value.startsWith('--')) {
      throw new Error(`Option ${argument} requires a value.`);
    }
    values.set(argument, value);
    index += 1;
  }

  const sourceOwnerUserId = requireValue(values, '--source-owner');
  const destinationOwnerUserId = requireValue(values, '--destination-owner');
  const configuredSourceRoot =
    values.get('--source-root') ??
    process.env.TRASOLVE_DATA_DIR?.trim() ??
    '.local/trasolve';
  const sourceRoot = resolve(repositoryRoot, configuredSourceRoot);
  const backupDirectory = values.get('--backup-dir');
  const reportPath = values.get('--report');

  return {
    sourceRoot,
    sourceOwnerUserId,
    destinationOwnerUserId,
    dryRun: flags.has('--dry-run'),
    writerStopped: flags.has('--confirm-writer-stopped'),
    ...(backupDirectory
      ? { backupDirectory: resolve(repositoryRoot, backupDirectory) }
      : {}),
    ...(reportPath ? { reportPath: resolve(repositoryRoot, reportPath) } : {}),
  };
}

function requireValue(
  values: ReadonlyMap<string, string>,
  name: string,
): string {
  const value = values.get(name);
  if (!value) {
    throw new Error(`Missing required option ${name}.\n\n${usage}`);
  }
  return value;
}

function formatError(cause: unknown): string {
  const messages: string[] = [];
  let current = cause;
  while (current instanceof Error) {
    messages.push(current.message);
    current = current.cause;
  }
  if (messages.length === 0) {
    return String(cause);
  }
  return messages.join('\nCaused by: ');
}
