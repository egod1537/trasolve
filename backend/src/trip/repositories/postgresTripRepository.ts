import { tripSchema, type Trip } from '@trasolve/shared';
import type { QueryResultRow } from 'pg';
import type { DatabaseExecutor } from '../../database/database.js';
import {
  createStoredTripV1,
  currentTripSchemaVersion,
  parseStoredTripV1,
} from '../storedTrip.js';
import {
  InvalidStoredTripError,
  TripAlreadyExistsError,
  TripRepositoryNotFoundError,
  TripRevisionConflictError,
  type StoredTripHandle,
  type TripRepository,
} from '../tripRepository.js';

interface TripRow extends QueryResultRow {
  readonly id: string;
  readonly owner_user_id: string;
  readonly title: string;
  readonly start_date: string | null;
  readonly end_date: string | null;
  readonly document: unknown;
  readonly schema_version: number;
  readonly revision: string;
  readonly created_at: Date;
  readonly updated_at: Date;
}

interface RevisionRow extends QueryResultRow {
  readonly revision: string;
}

const returningTripColumns = `
  id,
  owner_user_id,
  title,
  start_date,
  end_date,
  document,
  schema_version,
  revision,
  created_at,
  updated_at
`;
const positiveRevisionPattern = /^[1-9]\d*$/;

export class PostgresTripRepository implements TripRepository {
  public constructor(private readonly database: DatabaseExecutor) {}

  public async list(actorUserId: string): Promise<StoredTripHandle[]> {
    const result = await this.database.query<TripRow>(
      `SELECT ${returningTripColumns}
       FROM trasolve.trips
       WHERE owner_user_id = $1 AND deleted_at IS NULL
       ORDER BY updated_at DESC, id`,
      [actorUserId],
    );
    return result.rows.map(mapTripRow);
  }

  public async get(
    actorUserId: string,
    tripId: string,
  ): Promise<StoredTripHandle | null> {
    const result = await this.database.query<TripRow>(
      `SELECT ${returningTripColumns}
       FROM trasolve.trips
       WHERE id = $1
         AND owner_user_id = $2
         AND deleted_at IS NULL`,
      [tripId, actorUserId],
    );
    return result.rows[0] ? mapTripRow(result.rows[0]) : null;
  }

  public async create(
    actorUserId: string,
    trip: Trip,
  ): Promise<StoredTripHandle> {
    const currentTrip = parseOwnedTrip(actorUserId, trip);
    const document = createStoredTripV1(currentTrip);

    try {
      const result = await this.database.query<TripRow>(
        `INSERT INTO trasolve.trips (
           id,
           owner_user_id,
           title,
           start_date,
           end_date,
           document,
           schema_version,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4::date, $5::date, $6::jsonb, $7, $8, $9)
         RETURNING ${returningTripColumns}`,
        [
          currentTrip.id,
          actorUserId,
          currentTrip.title,
          currentTrip.startDate ?? null,
          currentTrip.endDate ?? null,
          document,
          currentTripSchemaVersion,
          currentTrip.createdAt,
          currentTrip.updatedAt,
        ],
      );
      return requireReturnedTrip(result.rows[0], 'create');
    } catch (cause) {
      if (isConstraintViolation(cause, '23505', 'trips_pkey')) {
        throw new TripAlreadyExistsError();
      }
      throw cause;
    }
  }

  public async update(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
    trip: Trip,
  ): Promise<StoredTripHandle> {
    validateExpectedRevision(expectedRevision);
    const currentTrip = parseOwnedTrip(actorUserId, trip);
    if (currentTrip.id !== tripId) {
      throw new InvalidStoredTripError('Trip id cannot change during update.');
    }
    const document = createStoredTripV1(currentTrip);
    const result = await this.database.query<TripRow>(
      `UPDATE trasolve.trips
       SET title = $4,
           start_date = $5::date,
           end_date = $6::date,
           document = $7::jsonb,
           schema_version = $8
       WHERE id = $1
         AND owner_user_id = $2
         AND revision = $3::bigint
         AND deleted_at IS NULL
       RETURNING ${returningTripColumns}`,
      [
        tripId,
        actorUserId,
        expectedRevision,
        currentTrip.title,
        currentTrip.startDate ?? null,
        currentTrip.endDate ?? null,
        document,
        currentTripSchemaVersion,
      ],
    );
    if (!result.rows[0]) {
      await this.throwWriteMiss(actorUserId, tripId);
    }
    return requireReturnedTrip(result.rows[0], 'update');
  }

  public async softDelete(
    actorUserId: string,
    tripId: string,
    expectedRevision: string,
  ): Promise<string> {
    validateExpectedRevision(expectedRevision);
    const result = await this.database.query<RevisionRow>(
      `UPDATE trasolve.trips
       SET deleted_at = clock_timestamp()
       WHERE id = $1
         AND owner_user_id = $2
         AND revision = $3::bigint
         AND deleted_at IS NULL
       RETURNING revision`,
      [tripId, actorUserId, expectedRevision],
    );
    const row = result.rows[0];
    if (!row) {
      await this.throwWriteMiss(actorUserId, tripId);
    }
    return validateRevision(row.revision);
  }

  private async throwWriteMiss(
    actorUserId: string,
    tripId: string,
  ): Promise<never> {
    const result = await this.database.query<RevisionRow>(
      `SELECT revision
       FROM trasolve.trips
       WHERE id = $1
         AND owner_user_id = $2
         AND deleted_at IS NULL`,
      [tripId, actorUserId],
    );
    if (result.rows[0]) {
      throw new TripRevisionConflictError();
    }
    throw new TripRepositoryNotFoundError();
  }
}

function mapTripRow(row: TripRow): StoredTripHandle {
  if (row.schema_version !== currentTripSchemaVersion) {
    throw new InvalidStoredTripError(
      `Unsupported Trip schema version: ${row.schema_version}.`,
    );
  }
  const revision = validateRevision(row.revision);

  try {
    const document = parseStoredTripV1(row.document);
    const trip = tripSchema.parse({
      id: row.id,
      userId: row.owner_user_id,
      title: row.title,
      ...(row.start_date ? { startDate: row.start_date } : {}),
      ...(row.end_date ? { endDate: row.end_date } : {}),
      days: document.days,
      createdAt: toIsoTimestamp(row.created_at),
      updatedAt: toIsoTimestamp(row.updated_at),
    });
    return { trip, revision };
  } catch (cause) {
    if (cause instanceof InvalidStoredTripError) {
      throw cause;
    }
    throw new InvalidStoredTripError('Stored Trip row is invalid.', { cause });
  }
}

function parseOwnedTrip(actorUserId: string, value: Trip): Trip {
  try {
    const trip = tripSchema.parse(value);
    if (trip.userId !== actorUserId) {
      throw new InvalidStoredTripError(
        'Authenticated actor must own the Trip in owner-only mode.',
      );
    }
    return trip;
  } catch (cause) {
    if (cause instanceof InvalidStoredTripError) {
      throw cause;
    }
    throw new InvalidStoredTripError('Trip is invalid for persistence.', {
      cause,
    });
  }
}

function validateExpectedRevision(revision: string): void {
  if (!positiveRevisionPattern.test(revision)) {
    throw new InvalidStoredTripError('Expected revision must be positive.');
  }
}

function validateRevision(revision: string): string {
  if (!positiveRevisionPattern.test(revision)) {
    throw new InvalidStoredTripError('Trip revision is invalid.');
  }
  return revision;
}

function requireReturnedTrip(
  row: TripRow | undefined,
  operation: string,
): StoredTripHandle {
  if (!row) {
    throw new Error(`Trip ${operation} did not return a row.`);
  }
  return mapTripRow(row);
}

function toIsoTimestamp(value: Date): string {
  if (!(value instanceof Date) || Number.isNaN(value.valueOf())) {
    throw new InvalidStoredTripError('Trip timestamp is invalid.');
  }
  return value.toISOString();
}

function isConstraintViolation(
  cause: unknown,
  code: string,
  constraint: string,
): boolean {
  if (!cause || typeof cause !== 'object') {
    return false;
  }
  const error = cause as { code?: unknown; constraint?: unknown };
  return error.code === code && error.constraint === constraint;
}
