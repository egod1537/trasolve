import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import {
  cp,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tripIdSchema, tripSchema, type Trip } from '@trasolve/shared';
import type { QueryResultRow } from 'pg';
import { z } from 'zod';
import type { Database, DatabaseExecutor } from '../../database/database.js';
import { PostgresTripRepository } from '../repositories/postgresTripRepository.js';
import { createStoredTripV1 } from '../storedTrip.js';

const migrationAdvisoryLockId = '742179493447191828';
const uuidSchema = z.uuid();

export interface LegacyTripMigrationOptions {
  readonly sourceRoot: string;
  readonly sourceOwnerUserId: string;
  readonly destinationOwnerUserId: string;
  readonly dryRun: boolean;
  readonly writerStopped: boolean;
  readonly backupDirectory?: string;
  readonly reportPath?: string;
}

export interface LegacyTripMigrationReport {
  readonly status: 'dry-run' | 'migrated';
  readonly createdAt: string;
  readonly source: {
    readonly root: string;
    readonly ownerUserId: string;
    readonly tripDirectory: string;
    readonly tripCount: number;
    readonly ignoredEntries: readonly string[];
  };
  readonly destination: {
    readonly ownerUserId: string;
    readonly activeTripCountBefore: number;
    readonly activeTripCountAfter: number;
    readonly insertedTripCount: number;
    readonly verifiedTripCount: number;
  };
  readonly backup: BackupReport | null;
  readonly trips: readonly TripMigrationEntry[];
}

interface BackupReport {
  readonly directory: string;
  readonly ownerSnapshotDirectory: string;
  readonly fileCount: number;
  readonly manifestPath: string;
}

interface TripMigrationEntry {
  readonly file: string;
  readonly id: string;
  readonly normalizationChanged: boolean;
  readonly normalizationDiff: readonly ValueDiff[];
  readonly before: TripSummary;
  readonly after: TripSummary;
}

interface TripSummary {
  readonly id: string | null;
  readonly title: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly dayCount: number;
  readonly placeCount: number;
  readonly polylineCount: number;
  readonly layerItemCount: number;
  readonly durationTimeFields: readonly DurationTimeField[];
}

interface DurationTimeField {
  readonly path: string;
  readonly value: unknown;
}

interface ValueDiff {
  readonly path: string;
  readonly kind: 'added' | 'removed' | 'changed';
  readonly before?: unknown;
  readonly after?: unknown;
}

interface SourceTrip {
  readonly file: string;
  readonly mappedTrip: Trip;
  readonly report: TripMigrationEntry;
}

interface FileDigest {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
}

interface ExistingTripRow extends QueryResultRow {
  readonly id: string;
  readonly owner_user_id: string;
  readonly deleted_at: Date | null;
}

interface CountRow extends QueryResultRow {
  readonly count: string;
}

export async function migrateLegacyTrips(
  database: Database,
  options: LegacyTripMigrationOptions,
): Promise<LegacyTripMigrationReport> {
  const normalizedOptions = validateOptions(options);
  if (normalizedOptions.reportPath) {
    await requireMissingPath(normalizedOptions.reportPath, 'report file');
  }
  const sourceOwnerDirectory = resolveOwnerDirectory(
    normalizedOptions.sourceRoot,
    normalizedOptions.sourceOwnerUserId,
  );
  await requireDirectory(sourceOwnerDirectory, 'source owner directory');

  const backup = normalizedOptions.dryRun
    ? null
    : await createVerifiedBackup(
        sourceOwnerDirectory,
        normalizedOptions.backupDirectory!,
        normalizedOptions,
      );
  const snapshotOwnerDirectory = backup
    ? backup.ownerSnapshotDirectory
    : sourceOwnerDirectory;
  const tripDirectory = join(snapshotOwnerDirectory, 'trips');
  await requireDirectory(tripDirectory, 'source Trip directory');
  const { trips, ignoredEntries } = await readSourceTrips(
    tripDirectory,
    normalizedOptions.sourceOwnerUserId,
    normalizedOptions.destinationOwnerUserId,
  );

  const destination = await database.transaction(async (executor) =>
    migrateInTransaction(
      executor,
      trips,
      normalizedOptions.destinationOwnerUserId,
      normalizedOptions.dryRun,
    ),
  );
  const report: LegacyTripMigrationReport = {
    status: normalizedOptions.dryRun ? 'dry-run' : 'migrated',
    createdAt: new Date().toISOString(),
    source: {
      root: normalizedOptions.sourceRoot,
      ownerUserId: normalizedOptions.sourceOwnerUserId,
      tripDirectory,
      tripCount: trips.length,
      ignoredEntries,
    },
    destination: {
      ownerUserId: normalizedOptions.destinationOwnerUserId,
      ...destination,
    },
    backup,
    trips: trips.map((trip) => trip.report),
  };

  const reportPath =
    normalizedOptions.reportPath ??
    (backup ? join(backup.directory, 'migration-report.json') : undefined);
  if (reportPath) {
    await writeJsonExclusive(reportPath, report);
  }
  return report;
}

function validateOptions(
  options: LegacyTripMigrationOptions,
): LegacyTripMigrationOptions {
  const sourceOwnerUserId = tripIdSchema.parse(
    options.sourceOwnerUserId.trim(),
  );
  const destinationOwnerUserId = uuidSchema.parse(
    options.destinationOwnerUserId.trim(),
  );
  const sourceRoot = resolve(options.sourceRoot);
  const backupDirectory = options.backupDirectory
    ? resolve(options.backupDirectory)
    : undefined;
  const reportPath = options.reportPath
    ? resolve(options.reportPath)
    : undefined;

  if (!options.dryRun && !options.writerStopped) {
    throw new Error(
      'Refusing migration without --confirm-writer-stopped. Stop the legacy file writer first.',
    );
  }
  if (!options.dryRun && !backupDirectory) {
    throw new Error('A new --backup-dir is required for a real migration.');
  }
  if (backupDirectory && pathsOverlap(sourceRoot, backupDirectory)) {
    throw new Error('Backup directory must be outside the source data root.');
  }
  if (reportPath && isWithin(sourceRoot, reportPath)) {
    throw new Error('Report file must be outside the source data root.');
  }
  if (
    backupDirectory &&
    reportPath === join(backupDirectory, 'backup-manifest.json')
  ) {
    throw new Error('Report file cannot replace the backup manifest.');
  }

  return {
    sourceRoot,
    sourceOwnerUserId,
    destinationOwnerUserId,
    dryRun: options.dryRun,
    writerStopped: options.writerStopped,
    ...(backupDirectory ? { backupDirectory } : {}),
    ...(reportPath ? { reportPath } : {}),
  };
}

function resolveOwnerDirectory(
  sourceRoot: string,
  ownerUserId: string,
): string {
  const ownerDirectory = resolve(sourceRoot, 'users', ownerUserId);
  assertWithin(sourceRoot, ownerDirectory, 'Source owner directory');
  return ownerDirectory;
}

async function createVerifiedBackup(
  sourceOwnerDirectory: string,
  backupDirectory: string,
  options: LegacyTripMigrationOptions,
): Promise<BackupReport> {
  const sourceBefore = await inventoryFiles(sourceOwnerDirectory);
  await mkdir(dirname(backupDirectory), { recursive: true });
  await mkdir(backupDirectory);
  const backupUsersDirectory = join(backupDirectory, 'users');
  const ownerSnapshotDirectory = join(
    backupUsersDirectory,
    options.sourceOwnerUserId,
  );
  await mkdir(backupUsersDirectory);
  await cp(sourceOwnerDirectory, ownerSnapshotDirectory, {
    recursive: true,
    force: false,
    errorOnExist: true,
    preserveTimestamps: true,
  });

  const [sourceAfter, backupFiles] = await Promise.all([
    inventoryFiles(sourceOwnerDirectory),
    inventoryFiles(ownerSnapshotDirectory),
  ]);
  assertSameInventory(
    sourceBefore,
    sourceAfter,
    'Source files changed while the backup was being created.',
  );
  assertSameInventory(sourceBefore, backupFiles, 'Backup verification failed.');

  const manifestPath = join(backupDirectory, 'backup-manifest.json');
  await writeJsonExclusive(manifestPath, {
    createdAt: new Date().toISOString(),
    sourceOwnerDirectory,
    ownerSnapshotDirectory,
    sourceOwnerUserId: options.sourceOwnerUserId,
    destinationOwnerUserId: options.destinationOwnerUserId,
    files: backupFiles,
  });
  return {
    directory: backupDirectory,
    ownerSnapshotDirectory,
    fileCount: backupFiles.length,
    manifestPath,
  };
}

async function readSourceTrips(
  tripDirectory: string,
  sourceOwnerUserId: string,
  destinationOwnerUserId: string,
): Promise<{ trips: SourceTrip[]; ignoredEntries: string[] }> {
  const entries = await readdir(tripDirectory, { withFileTypes: true });
  const tripFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  const ignoredEntries = entries
    .filter((entry) => !entry.isFile() || !entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
  const trips: SourceTrip[] = [];
  const ids = new Map<string, string>();

  for (const file of tripFiles) {
    const filePath = join(tripDirectory, file);
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    } catch (cause) {
      throw new Error(`Cannot parse source Trip file ${filePath}.`, { cause });
    }

    let normalized: Trip;
    try {
      normalized = tripSchema.parse(raw);
    } catch (cause) {
      throw new Error(
        `Source Trip validation failed for ${filePath}${describeRawId(raw)}.`,
        { cause },
      );
    }
    if (normalized.userId !== sourceOwnerUserId) {
      throw new Error(
        `Source Trip owner mismatch in ${filePath}: expected ${sourceOwnerUserId}, found ${normalized.userId}.`,
      );
    }
    if (file !== `${normalized.id}.json`) {
      throw new Error(
        `Source filename/Trip ID mismatch: ${filePath} contains ${normalized.id}.`,
      );
    }
    const previousFile = ids.get(normalized.id);
    if (previousFile) {
      throw new Error(
        `Duplicate source Trip ID ${normalized.id} in ${previousFile} and ${filePath}.`,
      );
    }
    ids.set(normalized.id, filePath);

    const mappedTrip = tripSchema.parse({
      ...normalized,
      userId: destinationOwnerUserId,
    });
    createStoredTripV1(mappedTrip);
    const normalizationDiff: ValueDiff[] = [];
    collectDiff(raw, normalized, '$', normalizationDiff);
    trips.push({
      file: filePath,
      mappedTrip,
      report: {
        file: filePath,
        id: normalized.id,
        normalizationChanged: normalizationDiff.length > 0,
        normalizationDiff,
        before: summarizeRawTrip(raw),
        after: summarizeTrip(normalized),
      },
    });
  }

  return { trips, ignoredEntries };
}

async function migrateInTransaction(
  executor: DatabaseExecutor,
  sourceTrips: readonly SourceTrip[],
  destinationOwnerUserId: string,
  dryRun: boolean,
): Promise<{
  activeTripCountBefore: number;
  activeTripCountAfter: number;
  insertedTripCount: number;
  verifiedTripCount: number;
}> {
  await executor.query('SELECT pg_advisory_xact_lock($1::bigint)', [
    migrationAdvisoryLockId,
  ]);
  const owner = await executor.query<QueryResultRow>(
    `SELECT id
     FROM trasolve.users
     WHERE id = $1 AND deleted_at IS NULL`,
    [destinationOwnerUserId],
  );
  if (!owner.rows[0]) {
    throw new Error(
      `Destination owner ${destinationOwnerUserId} does not exist or is deleted.`,
    );
  }

  const tripIds = sourceTrips.map((source) => source.mappedTrip.id);
  if (tripIds.length > 0) {
    const existing = await executor.query<ExistingTripRow>(
      `SELECT id, owner_user_id, deleted_at
       FROM trasolve.trips
       WHERE id = ANY($1::text[])
       ORDER BY id`,
      [tripIds],
    );
    if (existing.rows.length > 0) {
      const details = existing.rows
        .map(
          (row) =>
            `${row.id} (owner=${row.owner_user_id}, deleted=${row.deleted_at ? 'yes' : 'no'})`,
        )
        .join(', ');
      throw new Error(
        `Destination already contains Trip IDs; nothing was written: ${details}.`,
      );
    }
  }

  const activeTripCountBefore = await countActiveTrips(
    executor,
    destinationOwnerUserId,
  );
  if (dryRun) {
    return {
      activeTripCountBefore,
      activeTripCountAfter: activeTripCountBefore,
      insertedTripCount: 0,
      verifiedTripCount: 0,
    };
  }

  const repository = new PostgresTripRepository(executor);
  for (const source of sourceTrips) {
    try {
      await repository.create(destinationOwnerUserId, source.mappedTrip);
    } catch (cause) {
      throw new Error(
        `Destination insert failed for ${source.file} (${source.mappedTrip.id}).`,
        { cause },
      );
    }
  }

  let verifiedTripCount = 0;
  for (const source of sourceTrips) {
    const stored = await repository.get(
      destinationOwnerUserId,
      source.mappedTrip.id,
    );
    if (
      !stored ||
      stored.revision !== '1' ||
      !isDeepStrictEqual(stored.trip, source.mappedTrip)
    ) {
      throw new Error(
        `Round-trip verification failed for ${source.file} (${source.mappedTrip.id}).`,
      );
    }
    verifiedTripCount += 1;
  }

  const activeTripCountAfter = await countActiveTrips(
    executor,
    destinationOwnerUserId,
  );
  if (activeTripCountAfter !== activeTripCountBefore + sourceTrips.length) {
    throw new Error(
      `Destination count mismatch: expected ${activeTripCountBefore + sourceTrips.length}, found ${activeTripCountAfter}.`,
    );
  }
  return {
    activeTripCountBefore,
    activeTripCountAfter,
    insertedTripCount: sourceTrips.length,
    verifiedTripCount,
  };
}

async function countActiveTrips(
  executor: DatabaseExecutor,
  ownerUserId: string,
): Promise<number> {
  const result = await executor.query<CountRow>(
    `SELECT count(*)::text AS count
     FROM trasolve.trips
     WHERE owner_user_id = $1 AND deleted_at IS NULL`,
    [ownerUserId],
  );
  const count = Number.parseInt(result.rows[0]?.count ?? '', 10);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Destination Trip count is invalid.');
  }
  return count;
}

function summarizeTrip(trip: Trip): TripSummary {
  return {
    id: trip.id,
    title: trip.title,
    startDate: trip.startDate ?? null,
    endDate: trip.endDate ?? null,
    dayCount: trip.days.length,
    placeCount: trip.days.reduce((count, day) => count + day.places.length, 0),
    polylineCount: trip.days.reduce(
      (count, day) => count + day.polylines.length,
      0,
    ),
    layerItemCount: trip.days.reduce(
      (count, day) => count + day.layerItems.length,
      0,
    ),
    durationTimeFields: collectDurationTimeFields(trip),
  };
}

function summarizeRawTrip(value: unknown): TripSummary {
  const record = asRecord(value);
  const days = Array.isArray(record?.days) ? record.days : [];
  return {
    id: stringValue(record?.id),
    title: stringValue(record?.title),
    startDate: stringValue(record?.startDate),
    endDate: stringValue(record?.endDate),
    dayCount: days.length,
    placeCount: sumNestedArrayLength(days, 'places'),
    polylineCount: sumNestedArrayLength(days, 'polylines'),
    layerItemCount: sumNestedArrayLength(days, 'layerItems'),
    durationTimeFields: collectDurationTimeFields(value),
  };
}

function collectDurationTimeFields(value: unknown): DurationTimeField[] {
  const fields: DurationTimeField[] = [];
  const keys = new Set([
    'time',
    'visitDurationMinutes',
    'preferredDurationMinutes',
    'durationMinutes',
    'preferredTimeRange',
    'openingHours',
  ]);
  const visit = (current: unknown, path: string): void => {
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    const record = asRecord(current);
    if (!record) {
      return;
    }
    for (const [key, child] of Object.entries(record)) {
      const childPath = `${path}.${key}`;
      if (keys.has(key)) {
        fields.push({ path: childPath, value: child });
      } else {
        visit(child, childPath);
      }
    }
  };
  visit(value, '$');
  return fields;
}

function collectDiff(
  before: unknown,
  after: unknown,
  path: string,
  diffs: ValueDiff[],
): void {
  if (isDeepStrictEqual(before, after)) {
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const childPath = `${path}[${index}]`;
      if (index >= before.length) {
        diffs.push({ path: childPath, kind: 'added', after: after[index] });
      } else if (index >= after.length) {
        diffs.push({ path: childPath, kind: 'removed', before: before[index] });
      } else {
        collectDiff(before[index], after[index], childPath, diffs);
      }
    }
    return;
  }
  const beforeRecord = asRecord(before);
  const afterRecord = asRecord(after);
  if (beforeRecord && afterRecord) {
    const keys = new Set([
      ...Object.keys(beforeRecord),
      ...Object.keys(afterRecord),
    ]);
    for (const key of [...keys].sort()) {
      const childPath = `${path}.${key}`;
      if (!(key in beforeRecord)) {
        diffs.push({ path: childPath, kind: 'added', after: afterRecord[key] });
      } else if (!(key in afterRecord)) {
        diffs.push({
          path: childPath,
          kind: 'removed',
          before: beforeRecord[key],
        });
      } else {
        collectDiff(beforeRecord[key], afterRecord[key], childPath, diffs);
      }
    }
    return;
  }
  diffs.push({ path, kind: 'changed', before, after });
}

async function inventoryFiles(directory: string): Promise<FileDigest[]> {
  const files: FileDigest[] = [];
  const visit = async (current: string): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const path = join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(
          `Symbolic links are not allowed in Trip backups: ${path}.`,
        );
      }
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`Unsupported source filesystem entry: ${path}.`);
      }
      const contents = await readFile(path);
      files.push({
        path: relative(directory, path).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(contents).digest('hex'),
        size: contents.length,
      });
    }
  };
  await visit(directory);
  return files;
}

function assertSameInventory(
  expected: readonly FileDigest[],
  actual: readonly FileDigest[],
  message: string,
): void {
  if (!isDeepStrictEqual(expected, actual)) {
    throw new Error(message);
  }
}

async function requireDirectory(path: string, label: string): Promise<void> {
  let details;
  try {
    details = await stat(path);
  } catch (cause) {
    throw new Error(`Missing ${label}: ${path}.`, { cause });
  }
  if (!details.isDirectory()) {
    throw new Error(`Expected ${label} to be a directory: ${path}.`);
  }
}

async function requireMissingPath(path: string, label: string): Promise<void> {
  try {
    await stat(path);
  } catch (cause) {
    if (isMissingFilesystemEntry(cause)) {
      return;
    }
    throw new Error(`Cannot inspect ${label}: ${path}.`, { cause });
  }
  throw new Error(`Refusing to overwrite existing ${label}: ${path}.`);
}

async function writeJsonExclusive(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

function pathsOverlap(left: string, right: string): boolean {
  return isWithin(left, right) || isWithin(right, left);
}

function assertWithin(parent: string, child: string, label: string): void {
  if (!isWithin(parent, child)) {
    throw new Error(`${label} escaped its configured root.`);
  }
}

function isWithin(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function sumNestedArrayLength(values: readonly unknown[], key: string): number {
  return values.reduce<number>((count, value) => {
    const nested = asRecord(value)?.[key];
    return count + (Array.isArray(nested) ? nested.length : 0);
  }, 0);
}

function describeRawId(value: unknown): string {
  const id = stringValue(asRecord(value)?.id);
  return id ? ` (id=${id})` : '';
}

function isMissingFilesystemEntry(cause: unknown): boolean {
  return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
}
