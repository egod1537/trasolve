import { createHash } from 'node:crypto';
import { shareAttributionIdSchema } from '@trasolve/shared';

const attributionDomain = 'trasolve.analytics.share.v1\0';

/**
 * Produces a stable analytics join key without exposing the public share token.
 * The result is correlation data only and must never be used for authorization.
 */
export function createShareAttributionId(publicToken: string): string {
  const digest = createHash('sha256')
    .update(attributionDomain, 'utf8')
    .update(publicToken, 'utf8')
    .digest('base64url');
  return shareAttributionIdSchema.parse(`shr_${digest}`);
}
