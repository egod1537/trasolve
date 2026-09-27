import type { QueryResultRow } from 'pg';
import type { Database } from '../database/database.js';
import {
  AuthIdentityConflictError,
  type AuthIdentityRecord,
  type AuthRepository,
  type AuthUserRecord,
  type CreateUserWithIdentityInput,
  type UpdateIdentityLoginInput,
} from './authRepository.js';

interface IdentityRow extends QueryResultRow {
  readonly id: string;
  readonly user_id: string;
  readonly issuer: string;
  readonly subject: string;
  readonly email: string | null;
  readonly email_verified: boolean;
}

interface UserRow extends QueryResultRow {
  readonly id: string;
  readonly display_name: string;
  readonly avatar_url: string | null;
  readonly email: string;
  readonly email_verified: boolean;
}

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly database: Database) {}

  public async findIdentity(
    issuer: string,
    subject: string,
  ): Promise<AuthIdentityRecord | undefined> {
    const result = await this.database.query<IdentityRow>(
      `SELECT id, user_id, issuer, subject, email, email_verified
       FROM trasolve.auth_identities
       WHERE issuer = $1 AND subject = $2`,
      [issuer, subject],
    );
    return result.rows[0] ? mapIdentity(result.rows[0]) : undefined;
  }

  public async createUserWithIdentity(
    input: CreateUserWithIdentityInput,
  ): Promise<AuthIdentityRecord> {
    try {
      return await this.database.transaction(async (executor) => {
        const userResult = await executor.query<{ id: string }>(
          `INSERT INTO trasolve.users (display_name, avatar_url)
           VALUES ($1, $2)
           RETURNING id`,
          [input.displayName ?? '', input.avatarUrl ?? null],
        );
        const userId = userResult.rows[0]?.id;
        if (!userId) {
          throw new Error('User insert did not return an id.');
        }

        const identityResult = await executor.query<IdentityRow>(
          `INSERT INTO trasolve.auth_identities
             (user_id, issuer, subject, email, email_verified, last_login_at)
           VALUES ($1, $2, $3, $4, $5, clock_timestamp())
           RETURNING id, user_id, issuer, subject, email, email_verified`,
          [
            userId,
            input.issuer,
            input.subject,
            input.email,
            input.emailVerified,
          ],
        );
        const identity = identityResult.rows[0];
        if (!identity) {
          throw new Error('Identity insert did not return a row.');
        }
        return mapIdentity(identity);
      });
    } catch (cause) {
      if (isIdentityUniqueViolation(cause)) {
        throw new AuthIdentityConflictError();
      }
      throw cause;
    }
  }

  public async updateLastLogin(
    identityId: string,
    input: UpdateIdentityLoginInput,
  ): Promise<void> {
    const result = await this.database.query(
      `UPDATE trasolve.auth_identities
       SET email = $2,
           email_verified = $3,
           last_login_at = clock_timestamp()
       WHERE id = $1`,
      [identityId, input.email, input.emailVerified],
    );
    if (result.rowCount !== 1) {
      throw new Error('Identity disappeared while updating last login.');
    }
  }

  public async getUserById(
    userId: string,
  ): Promise<AuthUserRecord | undefined> {
    const result = await this.database.query<UserRow>(
      `SELECT
         users.id,
         users.display_name,
         users.avatar_url,
         identity.email,
         identity.email_verified
       FROM trasolve.users AS users
       JOIN LATERAL (
         SELECT email, email_verified
         FROM trasolve.auth_identities
         WHERE user_id = users.id AND email IS NOT NULL
         ORDER BY last_login_at DESC NULLS LAST, created_at DESC, id DESC
         LIMIT 1
       ) AS identity ON true
       WHERE users.id = $1 AND users.deleted_at IS NULL`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      emailVerified: row.email_verified,
    };
  }
}

function mapIdentity(row: IdentityRow): AuthIdentityRecord {
  return {
    id: row.id,
    userId: row.user_id,
    issuer: row.issuer,
    subject: row.subject,
    email: row.email,
    emailVerified: row.email_verified,
  };
}

function isIdentityUniqueViolation(cause: unknown): boolean {
  if (!cause || typeof cause !== 'object') {
    return false;
  }
  const error = cause as { code?: unknown; constraint?: unknown };
  return error.code === '23505' && error.constraint === 'auth_identity_unique';
}
