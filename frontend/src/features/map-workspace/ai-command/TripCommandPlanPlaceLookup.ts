import type {
  PlaceDetails,
  TripCommandPlanAddPlaceSource,
  TripCommandPlanStepId,
} from '@trasolve/shared';
import { getPlace, searchPlaces } from '@/shared/api/places';
import { TripCommandPlanError } from './TripCommandPlanError';
import {
  normalizePlaceLabel,
  matchesDestination,
  matchesPlaceName,
  type VerifiedDestination,
} from './TripCommandPlanPlaceMatch';
import { L } from '@/shared/i18n';

export async function lookupTripCommandPlanPlace(
  source: TripCommandPlanAddPlaceSource,
  stepId: TripCommandPlanStepId,
  signal?: AbortSignal,
  destination?: VerifiedDestination,
): Promise<PlaceDetails> {
  try {
    if (source.kind === 'external_place_id') {
      const place = await getPlace(source.placeId, {
        signal,
        ...(destination ? { languageCode: destination.languageCode } : {}),
      });
      if (
        place.id !== source.placeId ||
        (destination && !matchesDestination(place, destination))
      ) {
        throw Error('PLACE_REGION_MISMATCH');
      }
      return place;
    }
    const response = await searchPlaces(source.query, { signal });
    if (!response.suggestions.length) {
      throw new TripCommandPlanError(
        'unresolved_target',
        L('map:tripCommandPlanPlaceLookup.error.iCanTFindPlaceAdd'),
        stepId,
      );
    }
    const candidates = [
      ...new Map(response.suggestions.map((p) => [p.placeId, p])).values(),
    ];
    if (candidates.length > 5) {
      throw Error('TOO_MANY_CANDIDATES');
    }
    const matches: PlaceDetails[] = [];
    for (const candidate of candidates) {
      signal?.throwIfAborted();
      const place = await getPlace(candidate.placeId, {
        signal,
        ...(destination ? { languageCode: destination.languageCode } : {}),
      });
      if (place.id !== candidate.placeId) {
        throw Error('PLACE_ID_MISMATCH');
      }
      if (
        !destination &&
        source.countryCode &&
        place.countryCode !== source.countryCode
      ) {
        continue;
      }
      if (
        !destination &&
        source.locality &&
        !place.regions?.some((region) =>
          region.names.some(
            (name) =>
              normalizePlaceLabel(name) ===
              normalizePlaceLabel(source.locality!),
          ),
        )
      ) {
        continue;
      }
      if (destination && !matchesDestination(place, destination)) {
        continue;
      }
      let nameMatches = matchesPlaceName(
        destination ? [place.name] : [candidate.text, place.name],
        source,
        destination,
      );
      if (!nameMatches && destination) {
        for (const languageCode of ['en', 'ja'] as const) {
          const alternate = await getPlace(candidate.placeId, {
            signal,
            languageCode,
          });
          if (
            alternate.id !== place.id ||
            alternate.countryCode !== place.countryCode ||
            alternate.location.lat !== place.location.lat ||
            alternate.location.lng !== place.location.lng
          ) {
            throw Error('PLACE_DETAILS_MISMATCH');
          }
          nameMatches = matchesPlaceName([alternate.name], source, destination);
          if (nameMatches) {
            break;
          }
        }
      }
      if (
        nameMatches ||
        (!destination && !source.name && candidates.length === 1)
      ) {
        matches.push(place);
      }
    }
    if (matches.length !== 1) {
      throw new TripCommandPlanError(
        'ambiguous_target',
        L('map:tripCommandPlanPlaceLookup.error.thereWasNoSingleSearchResult'),
        stepId,
      );
    }
    return matches[0];
  } catch (cause) {
    if (cause instanceof TripCommandPlanError) {
      throw cause;
    }
    throw new TripCommandPlanError(
      'unresolved_target',
      L(
        'map:tripCommandPlanPlaceLookup.error.privilegedLocationInformationCouldNotBe',
      ),
      stepId,
    );
  }
}
