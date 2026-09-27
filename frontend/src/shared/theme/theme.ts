import {
  preferenceRepository,
  USER_PREFERENCE_KEYS,
} from '@/shared/preferences/preferenceRepository';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export const DARK_MODE_QUERY = '(prefers-color-scheme: dark)';

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const storedMode = preferenceRepository.read(USER_PREFERENCE_KEYS.theme);
  return isThemeMode(storedMode) ? storedMode : 'system';
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') {
    return mode;
  }
  return getSystemTheme();
}

export function saveThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  preferenceRepository.write(USER_PREFERENCE_KEYS.theme, mode);
}

export function applyThemeToDocument(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function getSystemTheme(): ResolvedTheme {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return 'light';
  }
  return window.matchMedia(DARK_MODE_QUERY).matches ? 'dark' : 'light';
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}
