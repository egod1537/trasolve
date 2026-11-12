import type { AuthConsentRecord } from '@trasolve/shared';
import type { DatabaseExecutor } from '../database/database.js';

export async function insertConsent(
  executor: DatabaseExecutor,
  userId: string,
  consent: AuthConsentRecord,
): Promise<boolean> {
  const result = await executor.query(
    `INSERT INTO trasolve.auth_consents
       (user_id, terms_version, privacy_version, accepted_at, profile_accepted, age_confirmed)
     SELECT id, $2, $3, $4, $5, $6 FROM trasolve.users
     WHERE id = $1 AND deleted_at IS NULL AND suspended_at IS NULL
     ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING`,
    [
      userId,
      consent.termsVersion,
      consent.privacyVersion,
      consent.acceptedAt,
      consent.profileAccepted,
      consent.ageConfirmed,
    ],
  );
  if (result.rowCount === 0) {
    const existing = await executor.query(
      `SELECT 1 FROM trasolve.auth_consents AS consent
       JOIN trasolve.users AS users ON users.id = consent.user_id
       WHERE user_id = $1 AND terms_version = $2 AND privacy_version = $3
         AND users.deleted_at IS NULL AND users.suspended_at IS NULL`,
      [userId, consent.termsVersion, consent.privacyVersion],
    );
    if (!existing.rowCount) {
      throw new Error('User is unavailable.');
    }
    return false;
  }
  return true;
}
