import { paymentModeSchema } from '@trasolve/shared';
import type { Database } from '../database/database.js';
import {
  billingAccountSchema,
  initialBillingAccount,
  type BillingAccount,
  type BillingOwner,
  type BillingRepository,
} from './billingRepository.js';

export class PostgresBillingRepository implements BillingRepository {
  public constructor(private readonly database: Database) {}

  public transact<T>(
    owner: BillingOwner,
    operation: (account: BillingAccount) => T,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO trasolve.billing_accounts(user_id,mode,document) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
        [owner.userId, owner.mode, JSON.stringify(initialBillingAccount())],
      );
      const result = await tx.query(
        `SELECT document FROM trasolve.billing_accounts WHERE user_id=$1 AND mode=$2 FOR UPDATE`,
        [owner.userId, owner.mode],
      );
      const account = billingAccountSchema.parse(result.rows[0]?.document);
      const value = operation(account);
      await tx.query(
        `UPDATE trasolve.billing_accounts SET document=$3,updated_at=now() WHERE user_id=$1 AND mode=$2`,
        [
          owner.userId,
          owner.mode,
          JSON.stringify(billingAccountSchema.parse(account)),
        ],
      );
      return structuredClone(value);
    });
  }

  public async findOrder(id: string): Promise<BillingOwner | null> {
    const result = await this.database.query(
      `SELECT user_id,mode FROM trasolve.billing_accounts WHERE document->'orders' ? $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row
      ? { userId: String(row.user_id), mode: paymentModeSchema.parse(row.mode) }
      : null;
  }

  public async dueSubscriptions(now: string): Promise<BillingOwner[]> {
    const result = await this.database.query(
      `SELECT user_id,mode FROM trasolve.billing_accounts WHERE document->'subscription'->>'nextAt' <= $1`,
      [now],
    );
    return result.rows.map((row) => ({
      userId: String(row.user_id),
      mode: paymentModeSchema.parse(row.mode),
    }));
  }
}
