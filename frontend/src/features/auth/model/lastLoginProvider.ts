import type { AuthUser } from '@trasolve/shared';

export type LoginProvider = Extract<
  AuthUser['loginProvider'],
  'google' | 'ssu'
>;

const storageKey = 'trasolve.last-login-provider';

export function readLastLoginProvider(): LoginProvider | null {
  try {
    const provider = window.localStorage.getItem(storageKey);
    return provider === 'google' || provider === 'ssu' ? provider : null;
  } catch {
    return null;
  }
}

export function rememberLastLoginProvider(
  provider: AuthUser['loginProvider'],
): void {
  if (provider !== 'google' && provider !== 'ssu') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, provider);
  } catch {
    // A blocked browser store must not prevent sign-in.
  }
}
