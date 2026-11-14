import type {
  PlaceDetails,
  TripCommandPlanAddPlaceSource,
} from '@trasolve/shared';
// Reused from the independently verified W10 matcher: Unicode and punctuation
// normalization only; geographic or language equivalence is never invented.
export const normalizePlaceLabel = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
    .trim()
    .split(' ')
    .sort()
    .join(' ');
/** Strip only a trailing administrative classifier, never infer a city alias. */
export function normalizeAdministrativeRegionLabel(
  label: string,
  kind: 'city' | 'region',
): string {
  const key = label
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
    .trim();
  return kind === 'city'
    ? key.replace(/(?:\s+city|市|시)$/u, '').trim()
    : key
        .replace(/(?:\s+prefecture|\s+metropolis|都|府|県|도|부)$/u, '')
        .trim();
}

export type VerifiedDestination = {
  readonly requestedLabel: string;
  readonly languageCode: 'ko' | 'en' | 'ja';
  countryCode: string;
  kind: 'city' | 'region';
  names: readonly string[];
  aliases: readonly string[];
  localityAliases: readonly string[];
};
export function matchesDestination(
  place: PlaceDetails,
  destination: VerifiedDestination,
): boolean {
  return (
    place.countryCode === destination.countryCode &&
    !!place.address?.trim() &&
    addressIncludesDestination(
      place.address!,
      destination.localityAliases,
      destination.kind,
    ) &&
    place.regions?.some(
      (r) =>
        r.kind === destination.kind &&
        r.names.some((n) =>
          destination.names.some(
            (expected) =>
              normalizeAdministrativeRegionLabel(n, destination.kind) ===
              normalizeAdministrativeRegionLabel(expected, destination.kind),
          ),
        ),
    ) === true
  );
}
/** Classifier variants come only from the already verified destination. */
export function addressIncludesDestination(
  address: string,
  aliases: readonly string[],
  kind: 'city' | 'region',
): boolean {
  const compact = (value: string) =>
    value.normalize('NFKC').toLowerCase().replace(/\s/g, '');
  const normalized = compact(address);
  return aliases.some((alias) =>
    [alias, normalizeAdministrativeRegionLabel(alias, kind)].some((label) => {
      const needle = compact(label);
      return needle.length > 0 && normalized.includes(needle);
    }),
  );
}

export function matchesPlaceName(
  names: string[],
  source: TripCommandPlanAddPlaceSource,
  destination?: VerifiedDestination,
): boolean {
  if (source.kind !== 'search') {
    return true;
  }
  const targets = [source.name, source.query].filter((n): n is string => !!n);
  const stripRegion = (text: string): string => {
    let words = normalizePlaceLabel(text).split(' ');
    for (const alias of [...(destination?.aliases ?? [])].sort(
      (a, b) => b.length - a.length,
    )) {
      const parts = normalizePlaceLabel(alias).split(' ');
      if (parts.every((p) => words.includes(p))) {
        words = words.filter((p) => !parts.includes(p));
      }
    }
    return words.sort().join(' ');
  };
  return targets.some((target) =>
    names.some(
      (name) =>
        normalizePlaceLabel(name) === normalizePlaceLabel(target) ||
        (!!stripRegion(target) && stripRegion(name) === stripRegion(target)),
    ),
  );
}
