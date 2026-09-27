import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import {
  AuthIdentityConflictError,
  type AuthIdentityRecord,
  type AuthRepository,
  type AuthUserRecord,
  type CreateUserWithIdentityInput,
  type UpdateIdentityLoginInput,
} from './authRepository.js';
import type {
  CreateSessionInput,
  SessionRecord,
  SessionRepository,
} from './sessionRepository.js';

const localUserSchema = z.strictObject({
  id: z.string().uuid(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
const localIdentitySchema = z.strictObject({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  issuer: z.string().min(1),
  subject: z.string().min(1),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  lastLoginAt: z.iso.datetime(),
});
const localSessionSchema = z.strictObject({
  tokenHash: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  userId: z.string().uuid(),
  expiresAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
});
const localAuthDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  users: z.array(localUserSchema),
  identities: z.array(localIdentitySchema),
  sessions: z.array(localSessionSchema),
});

type LocalAuthDocument = z.infer<typeof localAuthDocumentSchema>;
type LocalIdentity = z.infer<typeof localIdentitySchema>;

const developmentIdentity = {
  issuer: 'urn:trasolve:local-development',
  subject: 'default',
} as const;

export class LocalAuthRepository implements AuthRepository, SessionRepository {
  public constructor(options: { rootDir: string }) {
    this.path = join(resolve(options.rootDir), 'auth', 'store.json');
  }

  public async findIdentity(
    issuer: string,
    subject: string,
  ): Promise<AuthIdentityRecord | undefined> {
    const document = await this.readSnapshot();
    const identity = document.identities.find(
      (candidate) =>
        candidate.issuer === issuer && candidate.subject === subject,
    );
    return identity ? this.toIdentityRecord(identity) : undefined;
  }

  public createUserWithIdentity(
    input: CreateUserWithIdentityInput,
  ): Promise<AuthIdentityRecord> {
    return this.mutate((document) => {
      if (
        document.identities.some(
          (identity) =>
            identity.issuer === input.issuer &&
            identity.subject === input.subject,
        )
      ) {
        throw new AuthIdentityConflictError();
      }

      const userId = randomUUID();
      const identity: LocalIdentity = {
        id: randomUUID(),
        userId,
        issuer: input.issuer,
        subject: input.subject,
        email: input.email,
        emailVerified: input.emailVerified,
        lastLoginAt: new Date().toISOString(),
      };
      document.users.push({
        id: userId,
        displayName: input.displayName ?? '',
        avatarUrl: input.avatarUrl ?? null,
      });
      document.identities.push(identity);
      return this.toIdentityRecord(identity);
    });
  }

  public updateLastLogin(
    identityId: string,
    input: UpdateIdentityLoginInput,
  ): Promise<void> {
    return this.mutate((document) => {
      const identity = document.identities.find(
        (candidate) => candidate.id === identityId,
      );
      if (!identity) {
        throw new Error('Identity disappeared while updating last login.');
      }
      identity.email = input.email;
      identity.emailVerified = input.emailVerified;
      identity.lastLoginAt = new Date().toISOString();
    });
  }

  public async getUserById(
    userId: string,
  ): Promise<AuthUserRecord | undefined> {
    const document = await this.readSnapshot();
    const user = document.users.find((candidate) => candidate.id === userId);
    if (!user) {
      return undefined;
    }
    const identity = document.identities
      .filter((candidate) => candidate.userId === userId && candidate.email)
      .sort((left, right) =>
        right.lastLoginAt.localeCompare(left.lastLoginAt),
      )[0];
    if (!identity?.email) {
      return undefined;
    }
    return {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      email: identity.email,
      emailVerified: identity.emailVerified,
    };
  }

  public create(input: CreateSessionInput): Promise<void> {
    return this.mutate((document) => {
      const tokenHash = input.tokenHash.toString('base64url');
      if (
        document.sessions.some((session) => session.tokenHash === tokenHash)
      ) {
        throw new Error('Session token hash already exists.');
      }
      if (!document.users.some((user) => user.id === input.userId)) {
        throw new Error('Cannot create a session for an unknown user.');
      }
      document.sessions = document.sessions.filter(
        (session) => Date.parse(session.expiresAt) > Date.now(),
      );
      document.sessions.push({
        tokenHash,
        userId: input.userId,
        expiresAt: input.expiresAt.toISOString(),
        revokedAt: null,
      });
    });
  }

  public async findValidByTokenHash(
    tokenHash: Buffer,
  ): Promise<SessionRecord | undefined> {
    const document = await this.readSnapshot();
    const session = document.sessions.find(
      (candidate) =>
        candidate.tokenHash === tokenHash.toString('base64url') &&
        candidate.revokedAt === null &&
        Date.parse(candidate.expiresAt) > Date.now(),
    );
    if (
      !session ||
      !document.users.some((user) => user.id === session.userId)
    ) {
      return undefined;
    }
    return {
      userId: session.userId,
      expiresAt: new Date(session.expiresAt),
    };
  }

  public revokeByTokenHash(tokenHash: Buffer): Promise<void> {
    return this.mutate((document) => {
      const session = document.sessions.find(
        (candidate) => candidate.tokenHash === tokenHash.toString('base64url'),
      );
      if (session && session.revokedAt === null) {
        session.revokedAt = new Date().toISOString();
      }
    });
  }

  public async ensureDevelopmentUser(): Promise<string> {
    const existing = await this.findIdentity(
      developmentIdentity.issuer,
      developmentIdentity.subject,
    );
    if (existing) {
      return existing.userId;
    }

    try {
      const identity = await this.createUserWithIdentity({
        ...developmentIdentity,
        displayName: 'Trasolve Debug',
        email: 'debug@localhost',
        emailVerified: true,
      });
      return identity.userId;
    } catch (cause) {
      if (!(cause instanceof AuthIdentityConflictError)) {
        throw cause;
      }

      const identity = await this.findIdentity(
        developmentIdentity.issuer,
        developmentIdentity.subject,
      );
      if (!identity) {
        throw cause;
      }
      return identity.userId;
    }
  }

  private readonly path: string;
  private writeTail: Promise<void> = Promise.resolve();

  private async readSnapshot(): Promise<LocalAuthDocument> {
    await this.writeTail;
    return this.readDocument();
  }

  private mutate<Result>(
    operation: (document: LocalAuthDocument) => Result | Promise<Result>,
  ): Promise<Result> {
    const pending = this.writeTail.then(async () => {
      const document = await this.readDocument();
      const result = await operation(document);
      await this.writeDocument(document);
      return result;
    });
    this.writeTail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  private async readDocument(): Promise<LocalAuthDocument> {
    try {
      const parsed = localAuthDocumentSchema.safeParse(
        JSON.parse(await readFile(this.path, 'utf8')),
      );
      if (!parsed.success) {
        throw new Error('Local authentication store has an invalid schema.');
      }
      return parsed.data;
    } catch (cause) {
      if (this.isMissing(cause)) {
        return { schemaVersion: 1, users: [], identities: [], sessions: [] };
      }
      if (
        cause instanceof Error &&
        cause.message === 'Local authentication store has an invalid schema.'
      ) {
        throw cause;
      }
      throw new Error('Local authentication store could not be read.', {
        cause,
      });
    }
  }

  private async writeDocument(document: LocalAuthDocument): Promise<void> {
    const validated = localAuthDocumentSchema.parse(document);
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    await mkdir(dirname(this.path), { recursive: true });
    try {
      const file = await open(temporary, 'wx', 0o600);
      try {
        await file.writeFile(`${JSON.stringify(validated, null, 2)}\n`, 'utf8');
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, this.path);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  private toIdentityRecord(identity: LocalIdentity): AuthIdentityRecord {
    return {
      id: identity.id,
      userId: identity.userId,
      issuer: identity.issuer,
      subject: identity.subject,
      email: identity.email,
      emailVerified: identity.emailVerified,
    };
  }

  private isMissing(cause: unknown): boolean {
    return cause instanceof Error && 'code' in cause && cause.code === 'ENOENT';
  }
}
