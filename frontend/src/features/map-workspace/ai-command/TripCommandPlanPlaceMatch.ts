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
    destination.localityAliases.some((name) =>
      place
        .address!.normalize('NFKC')
        .toLowerCase()
        .replace(/\s/g, '')
        .includes(name.normalize('NFKC').toLowerCase().replace(/\s/g, '')),
    ) &&
    place.regions?.some(
      (r) =>
        r.kind === destination.kind &&
        r.names.some((n) =>
          destination.names.some(
            (expected) =>
              normalizePlaceLabel(n) === normalizePlaceLabel(expected),
          ),
        ),
    ) === true
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
