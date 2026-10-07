import type { AuthUser, GoogleOAuthProfile } from '@trasolve/shared';
import {
  AuthIdentityConflictError,
  type AuthIdentityRecord,
  type AuthRepository,
  type AuthUserRecord,
} from './authRepository.js';

export const canonicalGoogleIssuer = 'https://accounts.google.com';
const debugGuestIssuer = 'urn:trasolve:local-development';

export class AuthenticationService {
  public constructor(private readonly repository: AuthRepository) {}

  public async loginWithGoogle(profile: GoogleOAuthProfile): Promise<AuthUser> {
    let identity = await this.repository.findIdentity(
      canonicalGoogleIssuer,
      profile.subject,
    );

    if (!identity) {
      identity = await this.createGoogleIdentity(profile);
    } else {
      await this.updateExternalIdentity(identity, profile);
    }

    const user = await this.repository.getUserById(identity.userId);
    if (!user) {
      throw new Error('Authenticated user record is unavailable.');
    }
    return mapAuthUser(user);
  }

  public async getUserById(userId: string): Promise<AuthUser | undefined> {
    const user = await this.repository.getUserById(userId);
    return user ? mapAuthUser(user) : undefined;
  }

  public async ensureDebugGuest(subject: string): Promise<AuthUser> {
    let identity = await this.repository.findIdentity(
      debugGuestIssuer,
      subject,
    );
    if (!identity) {
      try {
        identity = await this.repository.createUserWithIdentity({
          issuer: debugGuestIssuer,
          subject,
          displayName: 'Trasolve Debug',
          email: `debug+${subject}@localhost`,
          emailVerified: true,
        });
      } catch (cause) {
        if (!(cause instanceof AuthIdentityConflictError)) {
          throw cause;
        }
        identity = await this.repository.findIdentity(
          debugGuestIssuer,
          subject,
        );
        if (!identity) {
          throw cause;
        }
      }
    }

    const user = await this.repository.getUserById(identity.userId);
    if (!user) {
      throw new Error('Debug guest user record is unavailable.');
    }
    return mapAuthUser(user);
  }

  private async createGoogleIdentity(
    profile: GoogleOAuthProfile,
  ): Promise<AuthIdentityRecord> {
    try {
      return await this.repository.createUserWithIdentity({
        issuer: canonicalGoogleIssuer,
        subject: profile.subject,
        displayName: profile.name,
        avatarUrl: profile.pictureUrl,
        email: profile.email,
        emailVerified: profile.emailVerified,
      });
    } catch (cause) {
      if (!(cause instanceof AuthIdentityConflictError)) {
        throw cause;
      }

      const identity = await this.repository.findIdentity(
        canonicalGoogleIssuer,
        profile.subject,
      );
      if (!identity) {
        throw cause;
      }
      await this.updateExternalIdentity(identity, profile);
      return identity;
    }
  }

  private async updateExternalIdentity(
    identity: AuthIdentityRecord,
    profile: GoogleOAuthProfile,
  ): Promise<void> {
    await this.repository.updateLastLogin(identity.id, {
      email: profile.email,
      emailVerified: profile.emailVerified,
    });
  }
}

function mapAuthUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    ...(user.displayName ? { name: user.displayName } : {}),
    ...(user.avatarUrl ? { pictureUrl: user.avatarUrl } : {}),
  };
}
