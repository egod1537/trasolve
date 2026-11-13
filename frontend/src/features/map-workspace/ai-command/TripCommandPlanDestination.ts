import type { TripCommandPlan } from '@trasolve/shared';
import { getPlace, searchPlaces } from '@/shared/api/places';
import { L } from '@/shared/i18n';
import { TripCommandPlanError } from './TripCommandPlanError';
import {
  normalizePlaceLabel,
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
            normalizePlaceLabel(alias) ===
            normalizePlaceLabel(source.locality!),
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
  if (unique.length !== 1) {
    throw destinationError();
  }
  const candidate = unique[0];
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
  const matchesRequest = (label: string): boolean =>
    regionKey(label, kind) === regionKey(query, kind);
  const names =
    city.regions
      ?.filter((r) => r.kind === kind)
      .flatMap((r) => r.names)
      .filter(matchesRequest) ?? [];
  if (
    city.id !== candidate.placeId ||
    !city.countryCode ||
    !city.address?.trim() ||
    normalizePlaceLabel(city.name) !== normalizePlaceLabel(query) ||
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
  if (
    !localityAliases.some((label) =>
      city
        .address!.normalize('NFKC')
        .toLowerCase()
        .replace(/\s/g, '')
        .includes(label.normalize('NFKC').toLowerCase().replace(/\s/g, '')),
    )
  ) {
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

/** Strip only a trailing administrative classifier, never infer a city alias. */
function regionKey(label: string, kind: 'city' | 'region'): string {
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
