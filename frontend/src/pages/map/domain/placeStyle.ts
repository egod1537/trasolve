import type { PlaceStyle, PlaceStyleType } from '@trasolve/shared';

export type PlaceStyleIconDefinition = {
  viewBox: '0 0 24 24';
  paths: readonly string[];
};

export type PlaceStyleOption = {
  type: PlaceStyleType;
  label: string;
  icon: PlaceStyleIconDefinition;
};

const icon = (...paths: string[]): PlaceStyleIconDefinition => ({
  viewBox: '0 0 24 24',
  paths,
});

export const PLACE_STYLE_OPTIONS: readonly PlaceStyleOption[] = [
  {
    type: 'general',
    label: '일반 장소',
    icon: icon(
      'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z',
      'M9.5 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z',
    ),
  },
  {
    type: 'landmark',
    label: '랜드마크',
    icon: icon(
      'm3 9 9-6 9 6',
      'M5 10h14M6 10v8m4-8v8m4-8v8m4-8v8M4 18h16M3 21h18',
    ),
  },
  {
    type: 'restaurant',
    label: '음식점',
    icon: icon('M7 3v18M4 3v4a3 3 0 0 0 6 0V3', 'M17 3v18M17 3c-3 2-3 7 0 9'),
  },
  {
    type: 'cafe',
    label: '카페',
    icon: icon(
      'M4 7h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7Z',
      'M17 9h2a2 2 0 0 1 0 4h-2M3 21h17',
    ),
  },
  {
    type: 'shopping',
    label: '쇼핑',
    icon: icon('M5 8h14l-1 13H6L5 8Z', 'M9 10V6a3 3 0 0 1 6 0v4'),
  },
  {
    type: 'lodging',
    label: '숙소',
    icon: icon(
      'M3 19V6M21 19v-8a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v4',
      'M3 15h18M6 11h5',
    ),
  },
  {
    type: 'culture',
    label: '박물관/문화',
    icon: icon('m3 8 9-5 9 5H3Z', 'M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M4 18h16'),
  },
  {
    type: 'nature',
    label: '공원/자연',
    icon: icon(
      'M12 21v-8',
      'M12 15c-5 0-8-3-8-8 5 0 8 3 8 8ZM12 13c0-5 3-8 8-8 0 5-3 8-8 8Z',
    ),
  },
  {
    type: 'observatory',
    label: '전망대',
    icon: icon(
      'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z',
      'M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
    ),
  },
  {
    type: 'transit',
    label: '교통/역',
    icon: icon(
      'M6 3h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z',
      'M4 11h16M8 18l-2 3m10-3 2 3M8 7h.01M16 7h.01',
    ),
  },
  {
    type: 'entertainment',
    label: '엔터테인먼트',
    icon: icon(
      'M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z',
      'm12 8 1.1 2.2 2.4.3-1.7 1.7.4 2.4-2.2-1.1-2.2 1.1.4-2.4-1.7-1.7 2.4-.3L12 8Z',
    ),
  },
  {
    type: 'other',
    label: '기타',
    icon: icon(
      'M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z',
      'M8 12h.01M12 12h.01M16 12h.01',
    ),
  },
] as const;

export const PLACE_STYLE_PALETTE = [
  '#2563eb',
  '#0e7490',
  '#059669',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#475569',
  '#0f172a',
] as const;

const PLACE_STYLE_BY_TYPE = new Map(
  PLACE_STYLE_OPTIONS.map((option) => [option.type, option]),
);

export function getPlaceStyleOption(type: PlaceStyleType): PlaceStyleOption {
  return PLACE_STYLE_BY_TYPE.get(type) ?? PLACE_STYLE_OPTIONS[0];
}

export function resolvePlaceStyle(
  placeStyle: PlaceStyle | undefined,
  fallbackColor: string,
): PlaceStyle {
  return placeStyle ?? { type: 'general', color: fallbackColor };
}
