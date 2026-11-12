import {
  LEGAL_VERSIONS,
  authConsentAcceptanceSchema,
  type AuthConsentAcceptance,
  type AuthConsentRecord,
  type AuthUser,
  type GoogleOAuthProfile,
} from '@trasolve/shared';
import {
  AuthIdentityConflictError,
  type AuthRepository,
  type AuthUserRecord,
} from './authRepository.js';

export const canonicalSsuIssuer = 'https://smartid.ssu.ac.kr';
export const canonicalGoogleIssuer = 'https://accounts.google.com';
const debugGuestIssuer = 'urn:trasolve:local-development';

export interface PendingIdentity {
  readonly issuer: string;
  readonly profile: {
    subject: string;
    email: string | null;
    emailVerified: boolean;
    name?: string;
    pictureUrl?: string;
  };
  readonly linkUserId?: string;
}

export class ConsentRequiredError extends Error {
  public constructor(public readonly identity: PendingIdentity) {
    super('Explicit consent is required before completing sign-in.');
    this.name = 'ConsentRequiredError';
  }
}

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

  public getConsent(userId: string): Promise<AuthConsentRecord | undefined> {
    return this.repository.getConsent(
      userId,
      LEGAL_VERSIONS.terms,
      LEGAL_VERSIONS.privacy,
    );
  }

  public async requiresConsent(userId: string): Promise<boolean> {
    const user = await this.repository.getUserById(userId);
    return (
      !user ||
      (user.issuer !== debugGuestIssuer && !(await this.getConsent(userId)))
    );
  }

  public async acceptForUser(
    userId: string,
    consent: AuthConsentRecord,
  ): Promise<AuthUser> {
    const user = await this.repository.getUserById(userId);
    if (!user) {
      throw new Error('User is unavailable.');
    }
    if (await this.getConsent(userId)) {
      return mapAuthUser(user);
    }
    await this.repository.saveConsent(
      userId,
      consent,
      user.issuer === canonicalGoogleIssuer && !consent.profileAccepted,
    );
    const updated = await this.getUserById(userId);
    if (!updated) {
      throw new Error('User is unavailable.');
    }
    return updated;
  }

  public completeConsent(
    identity: PendingIdentity,
    acceptance: AuthConsentAcceptance,
  ): Promise<AuthUser> {
    return this.loginWithIdentity(
      identity.issuer,
      identity.profile,
      identity.linkUserId,
      createConsentReceipt(acceptance),
    );
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
    profile: PendingIdentity['profile'],
    linkUserId?: string,
    consent?: AuthConsentRecord,
  ): Promise<AuthUser> {
    let identity = await this.repository.findIdentity(issuer, profile.subject);
    if (linkUserId && identity && identity.userId !== linkUserId) {
      throw new AuthIdentityConflictError();
    }
    const userId = identity?.userId ?? linkUserId;
    const existingConsent = userId ? await this.getConsent(userId) : undefined;
    if (!consent && !existingConsent) {
      throw new ConsentRequiredError({ issuer, profile, linkUserId });
    }
    const profileAccepted =
      (existingConsent ?? consent)?.profileAccepted === true;
    if (!identity) {
      try {
        const input = {
          issuer,
          subject: profile.subject,
          displayName:
            issuer === canonicalSsuIssuer || profileAccepted
              ? profile.name
              : undefined,
          avatarUrl: profileAccepted ? profile.pictureUrl : undefined,
          email: profile.email,
          emailVerified: profile.emailVerified,
          consent,
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
    if (consent && !existingConsent) {
      await this.acceptForUser(identity.userId, consent);
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

export function createConsentReceipt(
  acceptance: AuthConsentAcceptance,
): AuthConsentRecord {
  const parsed = authConsentAcceptanceSchema.parse(acceptance);
  if (
    parsed.termsVersion !== LEGAL_VERSIONS.terms ||
    parsed.privacyVersion !== LEGAL_VERSIONS.privacy
  ) {
    throw new RangeError('The legal document versions have changed.');
  }
  return { ...parsed, acceptedAt: new Date().toISOString() };
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
