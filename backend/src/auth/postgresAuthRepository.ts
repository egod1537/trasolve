import type { QueryResultRow } from 'pg';
import {
  initialTutorialProgress,
  tutorialProgressSchema,
  type AuthConsentRecord,
  type TutorialProgress,
} from '@trasolve/shared';
import type { Database } from '../database/database.js';
import { insertConsent } from './postgresConsent.js';
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
  readonly issuer: string;
  readonly id: string;
  readonly display_name: string;
  readonly avatar_url: string | null;
  readonly email: string | null;
  readonly email_verified: boolean;
}

export class PostgresAuthRepository implements AuthRepository {
  public constructor(private readonly database: Database) {}

  public async findIdentity(
    issuer: string,
    subject: string,
  ): Promise<AuthIdentityRecord | undefined> {
    const result = await this.database.query<IdentityRow>(
      `SELECT
         identities.id,
         identities.user_id,
         identities.issuer,
         identities.subject,
         identities.email,
         identities.email_verified
       FROM trasolve.auth_identities AS identities
       JOIN trasolve.users AS users ON users.id = identities.user_id
       WHERE identities.issuer = $1
         AND identities.subject = $2
         AND users.deleted_at IS NULL
         AND users.suspended_at IS NULL`,
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
        if (input.consent) {
          await insertConsent(executor, userId, input.consent);
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

  public async attachIdentity(
    userId: string,
    input: CreateUserWithIdentityInput,
  ): Promise<AuthIdentityRecord> {
    try {
      const result = await this.database.query<IdentityRow>(
        `INSERT INTO trasolve.auth_identities (user_id, issuer, subject, email, email_verified, last_login_at)
         SELECT id, $2, $3, $4, $5, clock_timestamp() FROM trasolve.users
         WHERE id = $1 AND deleted_at IS NULL AND suspended_at IS NULL
         RETURNING id, user_id, issuer, subject, email, email_verified`,
        [userId, input.issuer, input.subject, input.email, input.emailVerified],
      );
      if (!result.rows[0]) {
        throw new Error('User is unavailable.');
      }
      return mapIdentity(result.rows[0]);
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
         identity.issuer,
         identity.email,
         identity.email_verified
       FROM trasolve.users AS users
       JOIN LATERAL (
         SELECT issuer, email, email_verified
         FROM trasolve.auth_identities
         WHERE user_id = users.id
         ORDER BY last_login_at DESC NULLS LAST, created_at DESC, id DESC
         LIMIT 1
       ) AS identity ON true
       WHERE users.id = $1
         AND users.deleted_at IS NULL
         AND users.suspended_at IS NULL`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return {
      id: row.id,
      issuer: row.issuer,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      email: row.email,
      emailVerified: row.email_verified,
    };
  }
  public async getTutorialProgress(userId: string): Promise<TutorialProgress> {
    const result = await this.database.query<{ tutorial: unknown }>(
      `SELECT settings -> 'tutorial' AS tutorial FROM trasolve.users
       WHERE id = $1 AND deleted_at IS NULL AND suspended_at IS NULL`,
      [userId],
    );
    if (!result.rows[0]) {
      throw new Error('User is unavailable.');
    }
    return result.rows[0].tutorial == null
      ? initialTutorialProgress()
      : tutorialProgressSchema.parse(result.rows[0].tutorial);
  }

  public async getConsent(
    userId: string,
    termsVersion: string,
    privacyVersion: string,
  ): Promise<AuthConsentRecord | undefined> {
    const result = await this.database.query<{
      accepted_at: Date;
      profile_accepted: boolean;
    }>(
      `SELECT consent.accepted_at, consent.profile_accepted
       FROM trasolve.auth_consents AS consent
       JOIN trasolve.users AS users ON users.id = consent.user_id
       WHERE user_id = $1 AND terms_version = $2 AND privacy_version = $3
         AND users.deleted_at IS NULL AND users.suspended_at IS NULL`,
      [userId, termsVersion, privacyVersion],
    );
    const row = result.rows[0];
    return row
      ? {
          termsVersion,
          privacyVersion,
          termsAccepted: true,
          privacyAccepted: true,
          ageConfirmed: true,
          acceptedAt: row.accepted_at.toISOString(),
          profileAccepted: row.profile_accepted,
        }
      : undefined;
  }

  public async saveConsent(
    userId: string,
    consent: AuthConsentRecord,
    clearOptionalProfile: boolean,
  ): Promise<void> {
    await this.database.transaction(async (executor) => {
      const inserted = await insertConsent(executor, userId, consent);
      if (inserted && clearOptionalProfile) {
        await executor.query(
          `UPDATE trasolve.users SET display_name = '', avatar_url = NULL
           WHERE id = $1 AND deleted_at IS NULL AND suspended_at IS NULL`,
          [userId],
        );
      }
    });
  }

  public async saveTutorialProgress(
    userId: string,
    progress: TutorialProgress,
  ): Promise<void> {
    const result = await this.database.query(
      `UPDATE trasolve.users SET settings = jsonb_set(settings, '{tutorial}', $2::jsonb)
       WHERE id = $1 AND deleted_at IS NULL AND suspended_at IS NULL`,
      [userId, JSON.stringify(tutorialProgressSchema.parse(progress))],
    );
    if (result.rowCount !== 1) {
      throw new Error('User is unavailable.');
    }
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
