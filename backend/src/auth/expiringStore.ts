import { randomBytes } from 'node:crypto';

const lifetimeMs = 10 * 60 * 1000;
const maximumEntries = 500;

/** Bounded, short-lived handoffs; never use this store as a login session. */
export class ExpiringStore<T> {
  public constructor() {
    setInterval(() => this.removeExpired(), 60_000).unref();
  }

  public create(value: T): string {
    this.removeExpired();
    while (this.entries.size >= maximumEntries) {
      const key = this.entries.keys().next().value;
      if (key === undefined) {
        break;
      }
      this.entries.delete(key);
    }
    const id = randomBytes(32).toString('base64url');
    this.entries.set(id, { expiresAt: Date.now() + lifetimeMs, value });
    return id;
  }

  public get(id: string | undefined): T | undefined {
    this.removeExpired();
    return id ? this.entries.get(id)?.value : undefined;
  }

  public consume(id: string | undefined): T | undefined {
    const value = this.get(id);
    if (id) {
      this.entries.delete(id);
    }
    return value;
  }

  private readonly entries = new Map<string, { expiresAt: number; value: T }>();

  private removeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
