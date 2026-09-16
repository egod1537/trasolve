import { randomBytes } from 'node:crypto';

interface StoredSession<T> {
  expiresAt: number;
  value: T;
}

const maximumSessions = 2000;

/** In-memory login-session store, keyed by an opaque, unguessable session id. */
export class SessionStore<T> {
  private readonly sessions = new Map<string, StoredSession<T>>();

  public create(value: T, ttlMs: number): string {
    this.removeExpired();

    while (this.sessions.size >= maximumSessions) {
      const oldestKey = this.sessions.keys().next().value;
      if (typeof oldestKey !== 'string') {
        break;
      }
      this.sessions.delete(oldestKey);
    }

    let id: string;
    do {
      id = randomBytes(32).toString('base64url');
    } while (this.sessions.has(id));

    this.sessions.set(id, { expiresAt: Date.now() + ttlMs, value });
    return id;
  }

  public get(id: string | undefined): T | undefined {
    this.removeExpired();
    if (!id) {
      return undefined;
    }
    return this.sessions.get(id)?.value;
  }

  public destroy(id: string | undefined): void {
    if (!id) {
      return;
    }
    this.sessions.delete(id);
  }

  private removeExpired(): void {
    const now = Date.now();

    for (const [id, entry] of this.sessions) {
      if (entry.expiresAt <= now) {
        this.sessions.delete(id);
      }
    }
  }
}
