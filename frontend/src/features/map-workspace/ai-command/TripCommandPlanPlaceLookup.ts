import type {
  PlaceDetails,
  TripCommandPlanAddPlaceSource,
  TripCommandPlanStepId,
} from '@trasolve/shared';
import { getPlace, searchPlaces } from '@/shared/api/places';
import { TripCommandPlanError } from '@/features/map-workspace/ai-command/TripCommandPlanError';
import { L } from '@/shared/i18n';

export async function lookupTripCommandPlanPlace(
  source: TripCommandPlanAddPlaceSource,
  stepId: TripCommandPlanStepId,
  signal?: AbortSignal,
): Promise<PlaceDetails> {
  try {
    if (source.kind === 'external_place_id') {
      return await getPlace(source.placeId, { signal });
    }

    const response = await searchPlaces(source.query, { signal });
    if (response.suggestions.length === 0) {
      throw new TripCommandPlanError(
        'unresolved_target',
        L('map:tripCommandPlanPlaceLookup.error.iCanTFindPlaceAdd'),
        stepId,
      );
    }
    if (response.suggestions.length !== 1) {
      throw new TripCommandPlanError(
        'ambiguous_target',
        L('map:tripCommandPlanPlaceLookup.error.thereWasNoSingleSearchResult'),
        stepId,
      );
    }
    return await getPlace(response.suggestions[0].placeId, { signal });
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
