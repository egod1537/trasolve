import type { IncomingMessage } from 'node:http';
import type { CurrentUserResolver } from '../auth/currentUserResolver.js';
import type {
  AdminAuthorizationRecord,
  AdminRepository,
} from './adminRepository.js';

export class AdminAuthenticationRequiredError extends Error {
  public constructor() {
    super('Administrator authentication is required.');
    this.name = 'AdminAuthenticationRequiredError';
  }
}

export class AdminForbiddenError extends Error {
  public constructor() {
    super('Administrator access is not allowed.');
    this.name = 'AdminForbiddenError';
  }
}

export class AdminRequiresPostgresError extends Error {
  public constructor() {
    super('Administrator features require PostgreSQL persistence.');
    this.name = 'AdminRequiresPostgresError';
  }
}

export class AdminUnavailableError extends Error {
  public constructor() {
    super('Administrator authorization is temporarily unavailable.');
    this.name = 'AdminUnavailableError';
  }
}

export class AdminAuthorizationService {
  public constructor(
    private readonly currentUser: CurrentUserResolver,
    private readonly repository: AdminRepository | null,
    private readonly developmentAdmin?: AdminAuthorizationRecord,
  ) {}

  public async authorize(
    request: IncomingMessage,
  ): Promise<AdminAuthorizationRecord> {
    const repository = this.repository;
    const developmentAdmin = this.developmentAdmin;
    if (!repository && !developmentAdmin) {
      throw new AdminRequiresPostgresError();
    }

    let userId: string | undefined;
    try {
      userId = await this.currentUser.resolve(request);
    } catch {
      throw new AdminUnavailableError();
    }
    if (!userId) {
      throw new AdminAuthenticationRequiredError();
    }

    if (developmentAdmin) {
      if (userId !== developmentAdmin.id) {
        throw new AdminForbiddenError();
      }
      return developmentAdmin;
    }
    if (!repository) {
      throw new AdminRequiresPostgresError();
    }

    let record: AdminAuthorizationRecord | undefined;
    try {
      record = await repository.getAuthorization(userId);
    } catch {
      throw new AdminUnavailableError();
    }
    if (
      !record ||
      record.deleted ||
      record.suspended ||
      record.role !== 'admin' ||
      !record.hasVerifiedGoogleIdentity ||
      !record.email
    ) {
      throw new AdminForbiddenError();
    }
    return record;
  }
}
