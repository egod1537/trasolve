import type { QueryResultRow } from 'pg';
import type { DatabaseExecutor } from '../../database/database.js';
import type { TripShare } from '../tripShare.js';
import {
  TripShareAlreadyEnabledError,
  TripShareTokenConflictError,
  type TripShareRepository,
} from '../tripShareRepository.js';

interface TripShareRow extends QueryResultRow {
  readonly trip_id: string;
  readonly owner_user_id: string;
  readonly share_token: string;
  readonly searchable: boolean;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

const shareColumns = `
  trip_id,
  owner_user_id,
  share_token,
  searchable,
  created_at,
  updated_at
`;

export class PostgresTripShareRepository implements TripShareRepository {
  public constructor(private readonly database: DatabaseExecutor) {}

  public async getByTrip(
    actorUserId: string,
    tripId: string,
  ): Promise<TripShare | null> {
    const result = await this.database.query<TripShareRow>(
      `SELECT ${shareColumns}
       FROM trasolve.trip_shares
       WHERE trip_id = $1
         AND owner_user_id = $2::uuid`,
      [tripId, actorUserId],
    );
    return result.rows[0] ? mapShareRow(result.rows[0]) : null;
  }

  public async getByToken(token: string): Promise<TripShare | null> {
    const result = await this.database.query<TripShareRow>(
      `SELECT ${shareColumns}
       FROM trasolve.trip_shares
       WHERE share_token = $1::uuid`,
      [token],
    );
    return result.rows[0] ? mapShareRow(result.rows[0]) : null;
  }

  public async enable(
    actorUserId: string,
    tripId: string,
    token: string,
    searchable: boolean,
  ): Promise<TripShare> {
    try {
      const result = await this.database.query<TripShareRow>(
        `INSERT INTO trasolve.trip_shares
           (trip_id, owner_user_id, share_token, searchable)
         SELECT id, owner_user_id, $3::uuid, $4
         FROM trasolve.trips
         WHERE id = $1
           AND owner_user_id = $2::uuid
           AND deleted_at IS NULL
         RETURNING ${shareColumns}`,
        [tripId, actorUserId, token, searchable],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error('Trip share enable did not return a row.');
      }
      return mapShareRow(row);
    } catch (cause) {
      if (isConstraintViolation(cause, 'trip_shares_share_token_unique')) {
        throw new TripShareTokenConflictError();
      }
      if (isConstraintViolation(cause, 'trip_shares_pkey')) {
        throw new TripShareAlreadyEnabledError();
      }
      throw cause;
    }
  }

  public async update(
    actorUserId: string,
    tripId: string,
    searchable: boolean,
  ): Promise<TripShare | null> {
    const result = await this.database.query<TripShareRow>(
      `UPDATE trasolve.trip_shares
       SET searchable = $3,
           updated_at = clock_timestamp()
       WHERE trip_id = $1
         AND owner_user_id = $2::uuid
       RETURNING ${shareColumns}`,
      [tripId, actorUserId, searchable],
    );
    return result.rows[0] ? mapShareRow(result.rows[0]) : null;
  }

  public async disable(actorUserId: string, tripId: string): Promise<void> {
    await this.database.query(
      `DELETE FROM trasolve.trip_shares
       WHERE trip_id = $1
         AND owner_user_id = $2::uuid`,
      [tripId, actorUserId],
    );
  }
}

function mapShareRow(row: TripShareRow): TripShare {
  return {
    tripId: row.trip_id,
    ownerUserId: row.owner_user_id,
    token: row.share_token,
    searchable: row.searchable,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function isConstraintViolation(cause: unknown, constraint: string): boolean {
  if (!cause || typeof cause !== 'object') {
    return false;
  }
  const error = cause as { code?: unknown; constraint?: unknown };
  return error.code === '23505' && error.constraint === constraint;
}
