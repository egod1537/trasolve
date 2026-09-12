import {
  getPlaceCategoryLabel,
  resolvePlaceCategoryFromTypes,
  type PlaceCategory,
} from '../domain/placeCategory';

type Props = {
  types?: readonly string[];
  primaryType?: string | null;
  className?: string;
};

const CATEGORY_ICON_PATHS: Record<PlaceCategory, readonly string[]> = {
  food: ['M7 3v18M4 3v4a3 3 0 0 0 6 0V3', 'M17 3v18M17 3c-3 2-3 7 0 9'],
  cafe: [
    'M4 7h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V7Z',
    'M17 9h2a2 2 0 0 1 0 4h-2M3 21h17',
  ],
  transit: [
    'M6 3h12a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z',
    'M4 11h16M8 18l-2 3m10-3 2 3M8 7h.01M16 7h.01',
  ],
  lodging: [
    'M3 19V6M21 19v-8a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v4',
    'M3 15h18M6 11h5',
  ],
  shopping: ['M5 8h14l-1 13H6L5 8Z', 'M9 10V6a3 3 0 0 1 6 0v4'],
  attraction: ['m3 8 9-5 9 5H3Z', 'M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M4 18h16'],
  park: [
    'M12 21v-8',
    'M12 15c-5 0-8-3-8-8 5 0 8 3 8 8ZM12 13c0-5 3-8 8-8 0 5-3 8-8 8Z',
  ],
  medical: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v10M7 12h10'],
  education: ['m3 9 9-5 9 5-9 5-9-5Z', 'M7 12v5c3 2 7 2 10 0v-5M21 9v6'],
  default: [
    'M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z',
    'M9.5 10a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z',
  ],
};

export function PlaceTypeIcon({ types = [], primaryType, className }: Props) {
  const category = resolvePlaceCategoryFromTypes([primaryType, ...types]);
  const label = getPlaceCategoryLabel(category);

  return (
    <span
      className={className ? `place-type-icon ${className}` : 'place-type-icon'}
      role="img"
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {CATEGORY_ICON_PATHS[category].map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}
