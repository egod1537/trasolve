import type { TripCommandPlan } from '@trasolve/shared';
import { getPlace, searchPlaces } from '@/shared/api/places';
import { L } from '@/shared/i18n';
import { TripCommandPlanError } from './TripCommandPlanError';
import {
  normalizePlaceLabel,
  normalizeAdministrativeRegionLabel,
  addressIncludesDestination,
  type VerifiedDestination,
} from './TripCommandPlanPlaceMatch';

/** Explicit duration syntax only; season adjectives never become invented dates. */
export function readExplicitTripRequest(
  text: string | undefined,
): { destination: string; days: number } | undefined {
  const match = /^([^\n,;!?]+?)\s+(?:(\d+)\s*박\s*)?(\d+)\s*일(?:\s|$)/u.exec(
    text?.trim() ?? '',
  );
  if (!match) {
    return undefined;
  }
  const days = Number(match[3]);
  if (
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > 20 ||
    (match[2] && Number(match[2]) + 1 !== days)
  ) {
    return undefined;
  }
  return { destination: match[1].trim(), days };
}
export function destinationError(): TripCommandPlanError {
  return new TripCommandPlanError(
    'ambiguous_target',
    L('map:tripCommandPlanPlaceLookup.error.thereWasNoSingleSearchResult'),
  );
}
export async function resolvePlanDestination(
  plan: TripCommandPlan,
  userRequest?: string,
  signal?: AbortSignal,
): Promise<VerifiedDestination | undefined> {
  if (!plan.operations.some((op) => op.op === 'add_place')) {
    return undefined;
  }
  const explicit = readExplicitTripRequest(userRequest);
  const newDays = plan.operations.filter((op) => op.op === 'add_day').length;
  if (!explicit) {
    if (newDays) {
      throw destinationError();
    }
    return undefined;
  }
  if (newDays && newDays !== explicit.days) {
    throw destinationError();
  }
  const destination = await lookupDestination(explicit.destination, signal);
  for (const op of plan.operations) {
    if (op.op !== 'add_place' || op.source.kind !== 'search') {
      continue;
    }
    const source = op.source;
    if (
      (source.countryCode && source.countryCode !== destination.countryCode) ||
      (source.locality &&
        !destination.localityAliases.some(
          (alias) =>
            normalizeAdministrativeRegionLabel(alias, destination.kind) ===
            normalizeAdministrativeRegionLabel(
              source.locality!,
              destination.kind,
            ),
        ))
    ) {
      throw destinationError();
    }
  }
  return destination;
}
async function lookupDestination(
  query: string,
  signal?: AbortSignal,
): Promise<VerifiedDestination> {
  // The expectation comes from the user's request, never Plan.locality.
  const response = await searchPlaces(query, { signal });
  const cities = response.suggestions.filter((p) =>
    p.types.some((t) =>
      ['locality', 'postal_town', 'administrative_area_level_1'].includes(t),
    ),
  );
  const unique = [...new Map(cities.map((p) => [p.placeId, p])).values()];
  // A city and its surrounding region are separate Places. Select only a
  // unique label match to the frozen user request, never the first result.
  // Details below must still independently prove the requested geography.
  const exact = unique.filter(
    (p) => normalizePlaceLabel(p.text) === normalizePlaceLabel(query),
  );
  const matching = exact.length
    ? exact
    : unique.filter((p) => {
        const kind = p.types.some(
          (t) => t === 'locality' || t === 'postal_town',
        )
          ? 'city'
          : 'region';
        return (
          normalizeAdministrativeRegionLabel(p.text, kind) ===
          normalizeAdministrativeRegionLabel(query, kind)
        );
      });
  const selected = unique.length === 1 ? unique : matching;
  if (selected.length !== 1) {
    throw destinationError();
  }
  const candidate = selected[0];
  const languageCode = /[가-힣]/u.test(query)
    ? 'ko'
    : /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(query)
      ? 'ja'
      : 'en';
  const city = await getPlace(candidate.placeId, { signal, languageCode });
  const kind = candidate.types.some(
    (t) => t === 'locality' || t === 'postal_town',
  )
    ? 'city'
    : 'region';
  // The frozen request text is the authority. Neither a search label nor an ID
  // is proof that the returned Details describe the user's destination.
  const requestedRegion = normalizeAdministrativeRegionLabel(query, kind);
  const matchesRequest = (label: string): boolean =>
    requestedRegion.length > 0 &&
    normalizeAdministrativeRegionLabel(label, kind) === requestedRegion;
  const names =
    city.regions
      ?.filter((r) => r.kind === kind)
      .flatMap((r) => r.names)
      .filter(matchesRequest) ?? [];
  if (
    city.id !== candidate.placeId ||
    !city.countryCode ||
    !city.address?.trim() ||
    !matchesRequest(city.name) ||
    !names.length
  ) {
    throw destinationError();
  }
  const english = await getPlace(candidate.placeId, {
    signal,
    languageCode: 'en',
  });
  if (
    city.id !== candidate.placeId ||
    english.id !== city.id ||
    !city.countryCode ||
    city.countryCode !== english.countryCode ||
    !city.address?.trim() ||
    city.location.lat !== english.location.lat ||
    city.location.lng !== english.location.lng
  ) {
    throw destinationError();
  }
  const japanese = await getPlace(candidate.placeId, {
    signal,
    languageCode: 'ja',
  });
  if (
    japanese.id !== city.id ||
    japanese.countryCode !== city.countryCode ||
    japanese.location.lat !== city.location.lat ||
    japanese.location.lng !== city.location.lng
  ) {
    throw destinationError();
  }
  const aliases = [
    query,
    city.name,
    english.name,
    japanese.name,
    ...[city, english, japanese].flatMap(
      (p) =>
        p.regions?.filter((r) => r.kind === kind).flatMap((r) => r.names) ?? [],
    ),
    ...names,
    ...[city, english, japanese].flatMap(
      (p) =>
        p.regions
          ?.filter((r) => r.kind === 'country')
          .flatMap((r) => r.names) ?? [],
    ),
  ];
  const localityAliases = [
    query,
    city.name,
    english.name,
    japanese.name,
    ...names,
  ];
  if (!addressIncludesDestination(city.address!, localityAliases, kind)) {
    throw destinationError();
  }
  return Object.freeze({
    requestedLabel: query,
    languageCode,
    countryCode: city.countryCode!,
    kind,
    names: Object.freeze([...new Set([query, ...names])]),
    aliases: Object.freeze(aliases),
    localityAliases: Object.freeze(localityAliases),
  });
}

/** Context stored by the UI, not a field returned by the model. */
export function readRequestUserText(
  context: string | undefined,
): string | undefined {
  try {
    const value: unknown = JSON.parse(context ?? 'null');
    return value &&
      typeof value === 'object' &&
      'userRequest' in value &&
      typeof value.userRequest === 'string'
      ? value.userRequest
      : undefined;
  } catch {
    return undefined;
  }
}
