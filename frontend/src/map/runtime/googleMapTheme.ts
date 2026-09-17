/// <reference types="google.maps" />

import type { MapTheme } from '@/shared/types/mapTypes';

export function getGoogleMapThemeOptions(
  theme: MapTheme,
): Pick<google.maps.MapOptions, 'colorScheme'> {
  return { colorScheme: theme === 'dark' ? 'DARK' : 'LIGHT' };
}
