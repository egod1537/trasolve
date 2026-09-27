export const USER_PREFERENCE_KEYS = {
  language: 'trasolve.language',
  theme: 'trasolve.theme',
} as const;

export type UserPreferenceKey =
  (typeof USER_PREFERENCE_KEYS)[keyof typeof USER_PREFERENCE_KEYS];

export interface PreferenceRepository {
  read(key: UserPreferenceKey): string | null;
  write(key: UserPreferenceKey, value: string): void;
}

class BrowserPreferenceRepository implements PreferenceRepository {
  public read(key: UserPreferenceKey): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  public write(key: UserPreferenceKey, value: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Preferences still apply for the current session when storage is blocked.
    }
  }
}

export const preferenceRepository: PreferenceRepository =
  new BrowserPreferenceRepository();
