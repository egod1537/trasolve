import {
  reportTripPlanDiagnostic,
  type TripPlanDiagnosticSink,
} from './TripCommandPlanDiagnostics';
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
  onDiagnostic?: TripPlanDiagnosticSink,
): Promise<PlaceDetails> {
  let failureReported = false;
  const report = (event: Parameters<typeof reportTripPlanDiagnostic>[1]) => {
    failureReported ||= event.outcome === 'rejected';
    reportTripPlanDiagnostic(onDiagnostic, {
      ...event,
      hasName: source.kind === 'search' && !!source.name,
      hasLocality: source.kind === 'search' && !!source.locality,
      hasCountryCode: source.kind === 'search' && !!source.countryCode,
    });
  };
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
        report({
          stage: 'place',
          outcome: 'rejected',
          reason: 'place_region',
          candidateCount: 1,
          matchCount: 0,
        });
        throw Error('PLACE_REGION_MISMATCH');
      }
      report({
        stage: 'place',
        outcome: 'resolved',
        reason: 'place_matches',
        candidateCount: 1,
        matchCount: 1,
      });
      return place;
    }
    const response = await searchPlaces(source.query, { signal });
    if (!response.suggestions.length) {
      report({
        stage: 'place',
        outcome: 'rejected',
        reason: 'place_autocomplete_empty',
        autocompleteCount: 0,
        candidateCount: 0,
        matchCount: 0,
      });
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
      report({
        stage: 'place',
        outcome: 'rejected',
        reason: 'place_candidate_limit',
        candidateCount: candidates.length,
      });
      throw Error('TOO_MANY_CANDIDATES');
    }
    const matches: PlaceDetails[] = [];
    let regionMatchCount = 0;
    let nameMatchCount = 0;
    for (const candidate of candidates) {
      signal?.throwIfAborted();
      const place = await getPlace(candidate.placeId, {
        signal,
        ...(destination ? { languageCode: destination.languageCode } : {}),
      });
      if (place.id !== candidate.placeId) {
        report({
          stage: 'place',
          outcome: 'rejected',
          reason: 'place_details_identity',
          candidateCount: candidates.length,
        });
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
      regionMatchCount += 1;
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
            report({
              stage: 'place',
              outcome: 'rejected',
              reason: 'place_translation_identity',
              candidateCount: candidates.length,
            });
            throw Error('PLACE_DETAILS_MISMATCH');
          }
          nameMatches = matchesPlaceName([alternate.name], source, destination);
          if (nameMatches) {
            break;
          }
        }
      }
      if (nameMatches) {
        nameMatchCount += 1;
      }
      if (
        nameMatches ||
        (!destination && !source.name && candidates.length === 1)
      ) {
        matches.push(place);
      }
    }
    report({
      stage: 'place',
      outcome: matches.length === 1 ? 'resolved' : 'rejected',
      reason: 'place_matches',
      autocompleteCount: response.suggestions.length,
      candidateCount: candidates.length,
      regionMatchCount,
      nameMatchCount,
      matchCount: matches.length,
    });
    if (matches.length !== 1) {
      throw new TripCommandPlanError(
        'ambiguous_target',
        L('map:tripCommandPlanPlaceLookup.error.thereWasNoSingleSearchResult'),
        stepId,
      );
    }
    return matches[0];
  } catch (cause) {
    if (!failureReported) {
      report({
        stage: 'place',
        outcome: 'rejected',
        reason: 'lookup_request_failed',
      });
    }
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
