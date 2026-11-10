import type { AuthUser, GoogleOAuthProfile } from '@trasolve/shared';
import {
  AuthIdentityConflictError,
  type AuthRepository,
  type AuthUserRecord,
} from './authRepository.js';

export const canonicalSsuIssuer = 'https://smartid.ssu.ac.kr';
export const canonicalGoogleIssuer = 'https://accounts.google.com';
const debugGuestIssuer = 'urn:trasolve:local-development';

export class AuthenticationService {
  public constructor(private readonly repository: AuthRepository) {}

  public loginWithGoogle(
    profile: GoogleOAuthProfile,
    linkUserId?: string,
  ): Promise<AuthUser> {
    return this.loginWithIdentity(canonicalGoogleIssuer, profile, linkUserId);
  }

  public loginWithSsu(
    profile: { subject: string; name: string },
    linkUserId?: string,
  ): Promise<AuthUser> {
    return this.loginWithIdentity(
      canonicalSsuIssuer,
      {
        ...profile,
        email: null,
        emailVerified: false,
      },
      linkUserId,
    );
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

  private async loginWithIdentity(
    issuer: string,
    profile: {
      subject: string;
      email: string | null;
      emailVerified: boolean;
      name?: string;
      pictureUrl?: string;
    },
    linkUserId?: string,
  ): Promise<AuthUser> {
    let identity = await this.repository.findIdentity(issuer, profile.subject);
    if (!identity) {
      try {
        const input = {
          issuer,
          subject: profile.subject,
          displayName: profile.name,
          avatarUrl: profile.pictureUrl,
          email: profile.email,
          emailVerified: profile.emailVerified,
        };
        identity = linkUserId
          ? await this.repository.attachIdentity(linkUserId, input)
          : await this.repository.createUserWithIdentity(input);
      } catch (cause) {
        if (!(cause instanceof AuthIdentityConflictError)) {
          throw cause;
        }
        identity = await this.repository.findIdentity(issuer, profile.subject);
        if (!identity) {
          throw cause;
        }
      }
    }
    if (linkUserId && identity.userId !== linkUserId) {
      throw new AuthIdentityConflictError();
    }
    await this.repository.updateLastLogin(identity.id, {
      email: profile.email,
      emailVerified: profile.emailVerified,
    });
    const user = await this.repository.getUserById(identity.userId);
    if (!user) {
      throw new Error('Authenticated user record is unavailable.');
    }
    return mapAuthUser(user);
  }
}

function mapAuthUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    loginProvider:
      user.issuer === canonicalSsuIssuer
        ? 'ssu'
        : user.issuer === canonicalGoogleIssuer
          ? 'google'
          : 'local',
    ...(user.displayName ? { name: user.displayName } : {}),
    ...(user.avatarUrl ? { pictureUrl: user.avatarUrl } : {}),
  };
}
