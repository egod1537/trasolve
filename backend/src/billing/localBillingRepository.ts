import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  initialBillingAccount,
  localBillingSchema,
  parseBillingOwner,
  type BillingAccount,
  type BillingOwner,
  type BillingRepository,
} from './billingRepository.js';

// Like local authentication persistence, this adapter targets one development
// process. Multi-process deployments use PostgreSQL row locks instead.
export class LocalBillingRepository implements BillingRepository {
  public constructor(rootDir: string) {
    this.path = join(rootDir, 'billing', 'store.json');
  }

  public transact<T>(
    owner: BillingOwner,
    operation: (account: BillingAccount) => T,
  ): Promise<T> {
    const task = this.tail.then(async () => {
      const document = await this.read();
      const key = `${owner.userId}:${owner.mode}`;
      const account = (document[key] ??= initialBillingAccount());
      const result = operation(account);
      await mkdir(dirname(this.path), { recursive: true });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(
            JSON.stringify(localBillingSchema.parse(document)) + '\n',
          );
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, this.path);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
      return structuredClone(result);
    });
    this.tail = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  public async findOrder(orderId: string): Promise<BillingOwner | null> {
    await this.tail;
    const entry = Object.entries(await this.read()).find(([, a]) =>
      Object.hasOwn(a.orders, orderId),
    );
    return entry ? parseBillingOwner(entry[0]) : null;
  }

  public async dueSubscriptions(now: string): Promise<BillingOwner[]> {
    await this.tail;
    return Object.entries(await this.read())
      .filter(([, a]) => a.subscription && a.subscription.nextAt <= now)
      .map(([key]) => parseBillingOwner(key));
  }

  private readonly path: string;
  private tail: Promise<void> = Promise.resolve();
  private async read() {
    try {
      return localBillingSchema.parse(
        JSON.parse(await readFile(this.path, 'utf8')),
      );
    } catch (cause) {
      if (
        cause instanceof Error &&
        'code' in cause &&
        cause.code === 'ENOENT'
      ) {
        return {};
      }
      throw cause;
    }
  }
}
