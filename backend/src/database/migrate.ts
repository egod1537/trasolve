import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { QueryResultRow } from 'pg';
import type { Database, DatabaseExecutor } from './database.js';

const defaultMigrationsDirectory = fileURLToPath(
  new URL('../../migrations/', import.meta.url),
);
const migrationFilePattern = /^(\d{3,})_([a-z0-9][a-z0-9_-]*)\.sql$/;
const migrationLockId = '742179493447191827';

interface Migration {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly sql: string;
}

interface AppliedMigrationRow extends QueryResultRow {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
}

export interface MigrationResult {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}

export interface MigrationOptions {
  readonly migrationsDirectory?: string;
}

export async function runMigrations(
  database: Database,
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const migrations = await readMigrations(
    options.migrationsDirectory ?? defaultMigrationsDirectory,
  );

  return database.transaction(async (executor) => {
    await executor.query('SELECT pg_advisory_xact_lock($1::bigint)', [
      migrationLockId,
    ]);
    await ensureMetadataTable(executor);

    const appliedResult = await executor.query<AppliedMigrationRow>(
      `SELECT version, name, checksum
       FROM public.trasolve_schema_migrations
       ORDER BY version`,
    );
    const availableByVersion = new Map(
      migrations.map((migration) => [migration.version, migration]),
    );
    const appliedByVersion = new Map(
      appliedResult.rows.map((migration) => [migration.version, migration]),
    );

    for (const applied of appliedResult.rows) {
      const available = availableByVersion.get(applied.version);
      if (!available) {
        throw new Error(
          `Applied migration ${applied.version} (${applied.name}) is missing from this build.`,
        );
      }
      if (available.name !== applied.name) {
        throw new Error(
          `Migration ${applied.version} was renamed from ${applied.name} to ${available.name}.`,
        );
      }
      if (available.checksum !== applied.checksum) {
        throw new Error(
          `Migration ${available.name} was modified after it was applied.`,
        );
      }
    }

    const applied: string[] = [];
    const skipped: string[] = [];
    for (const migration of migrations) {
      if (appliedByVersion.has(migration.version)) {
        skipped.push(migration.name);
        continue;
      }

      await executor.query(migration.sql);
      await executor.query(
        `INSERT INTO public.trasolve_schema_migrations
           (version, name, checksum)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, migration.checksum],
      );
      applied.push(migration.name);
    }

    return { applied, skipped };
  });
}

async function readMigrations(directory: string): Promise<Migration[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const migrations: Migration[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.sql')) {
      continue;
    }

    const match = migrationFilePattern.exec(entry.name);
    if (!match) {
      throw new Error(
        `Invalid migration filename ${entry.name}; expected NNN_name.sql.`,
      );
    }

    const version = Number.parseInt(match[1], 10);
    if (!Number.isSafeInteger(version) || version <= 0) {
      throw new Error(`Invalid migration version in ${entry.name}.`);
    }
    const contents = await readFile(resolve(directory, entry.name));
    const sql = contents.toString('utf8');

    migrations.push({
      version,
      name: entry.name,
      checksum: createHash('sha256').update(contents).digest('hex'),
      sql,
    });
  }

  migrations.sort((left, right) => left.version - right.version);
  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index - 1].version === migrations[index].version) {
      throw new Error(
        `Duplicate migration version ${migrations[index].version}.`,
      );
    }
  }

  return migrations;
}

async function ensureMetadataTable(executor: DatabaseExecutor): Promise<void> {
  await executor.query(`
    CREATE TABLE IF NOT EXISTS public.trasolve_schema_migrations (
      version integer PRIMARY KEY,
      name text NOT NULL UNIQUE,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT trasolve_schema_migrations_version_positive CHECK (version > 0),
      CONSTRAINT trasolve_schema_migrations_checksum_format CHECK (checksum ~ '^[0-9a-f]{64}$')
    )
  `);
  await executor.query(`
    COMMENT ON TABLE public.trasolve_schema_migrations IS
    'Immutable Trasolve database migrations with SHA-256 checksums.'
  `);
}
