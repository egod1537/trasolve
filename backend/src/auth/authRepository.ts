export interface AuthIdentityRecord {
  readonly id: string;
  readonly userId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly email: string | null;
  readonly emailVerified: boolean;
}

export interface AuthUserRecord {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly email: string;
  readonly emailVerified: boolean;
}

export interface CreateUserWithIdentityInput {
  readonly issuer: string;
  readonly subject: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly email: string;
  readonly emailVerified: boolean;
}

export interface UpdateIdentityLoginInput {
  readonly email: string;
  readonly emailVerified: boolean;
}

export interface AuthRepository {
  findIdentity(
    issuer: string,
    subject: string,
  ): Promise<AuthIdentityRecord | undefined>;
  createUserWithIdentity(
    input: CreateUserWithIdentityInput,
  ): Promise<AuthIdentityRecord>;
  updateLastLogin(
    identityId: string,
    input: UpdateIdentityLoginInput,
  ): Promise<void>;
  getUserById(userId: string): Promise<AuthUserRecord | undefined>;
}

export class AuthIdentityConflictError extends Error {
  public constructor() {
    super('The external identity is already linked.');
    this.name = 'AuthIdentityConflictError';
  }
}
