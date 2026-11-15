import { z } from 'zod';
import { loadBackendEnvironment } from '../configuration/environment.js';
import { Database } from '../database/database.js';
import { PostgresAdminRepository } from './postgresAdminRepository.js';

loadBackendEnvironment();

void main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : 'Unknown failure.';
  console.error(`Admin bootstrap failed: ${message}`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const database = Database.fromEnvironment();
  try {
    const repository = new PostgresAdminRepository(database);
    const record = await repository.inspect(options.userId);
    if (!record) {
      throw new Error(
        'The user must be active and linked to a verified canonical Google identity.',
      );
    }
    printRecord(record, options.dryRun ? 'DRY RUN' : 'CONFIRMED TARGET');
    if (options.dryRun) {
      return;
    }
    const granted = await repository.grant(options.userId);
    if (!granted) {
      throw new Error('The target became ineligible before the role update.');
    }
    printRecord(granted, 'ADMIN GRANTED');
  } finally {
    await database.close();
  }
}

function parseArguments(values: readonly string[]): {
  readonly userId: string;
  readonly dryRun: boolean;
} {
  let userId: string | undefined;
  let confirm = false;
  let dryRun = false;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--user-id') {
      userId = values[index + 1];
      index += 1;
    } else if (value === '--confirm') {
      confirm = true;
    } else if (value === '--dry-run') {
      dryRun = true;
    } else {
      throw usageError();
    }
  }
  const parsed = z.uuid().safeParse(userId);
  if (!parsed.success || (!dryRun && !confirm)) {
    throw usageError();
  }
  return { userId: parsed.data, dryRun };
}

function usageError(): Error {
  return new Error(
    'Usage: admin:bootstrap -- --user-id <internal UUID> --dry-run | --confirm',
  );
}

function printRecord(
  record: {
    readonly id: string;
    readonly displayName: string;
    readonly email: string;
    readonly issuer: string;
    readonly role: string;
  },
  label: string,
): void {
  console.info(label);
  console.info(`userId: ${record.id}`);
  console.info(`displayName: ${JSON.stringify(record.displayName)}`);
  console.info(`email: ${maskEmail(record.email)}`);
  console.info(`issuer: ${record.issuer}`);
  console.info(`role: ${record.role}`);
}

function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  return at > 0 ? `${value.slice(0, 1)}***${value.slice(at)}` : '***';
}
