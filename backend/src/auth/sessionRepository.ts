export interface CreateSessionInput {
  readonly tokenHash: Buffer;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface SessionRecord {
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<void>;
  findValidByTokenHash(tokenHash: Buffer): Promise<SessionRecord | undefined>;
  revokeByTokenHash(tokenHash: Buffer): Promise<void>;
}
