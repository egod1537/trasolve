import type { QueryResultRow } from 'pg';
import type { Database } from '../database/database.js';
import type {
  CreateSessionInput,
  SessionRecord,
  SessionRepository,
} from './sessionRepository.js';

interface SessionRow extends QueryResultRow {
  readonly user_id: string;
  readonly expires_at: Date;
}

export class PostgresSessionRepository implements SessionRepository {
  public constructor(private readonly database: Database) {}

  public async create(input: CreateSessionInput): Promise<void> {
    await this.database.query(
      `INSERT INTO trasolve.auth_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [input.tokenHash, input.userId, input.expiresAt],
    );
  }

  public async findValidByTokenHash(
    tokenHash: Buffer,
  ): Promise<SessionRecord | undefined> {
    const result = await this.database.query<SessionRow>(
      `SELECT sessions.user_id, sessions.expires_at
       FROM trasolve.auth_sessions AS sessions
       JOIN trasolve.users AS users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1
         AND sessions.revoked_at IS NULL
         AND sessions.expires_at > clock_timestamp()
         AND users.deleted_at IS NULL`,
      [tokenHash],
    );
    const row = result.rows[0];
    return row ? { userId: row.user_id, expiresAt: row.expires_at } : undefined;
  }

  public async revokeByTokenHash(tokenHash: Buffer): Promise<void> {
    await this.database.query(
      `UPDATE trasolve.auth_sessions
       SET revoked_at = COALESCE(revoked_at, clock_timestamp())
       WHERE token_hash = $1`,
      [tokenHash],
    );
  }
}
