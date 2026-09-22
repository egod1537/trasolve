import type {
  PlaceDetails,
  TripCommandPlanAddPlaceSource,
  TripCommandPlanStepId,
} from '@trasolve/shared';
import { getPlace, searchPlaces } from '@/shared/api/places';
import { TripCommandPlanError } from '@/features/map-workspace/ai-command/TripCommandPlanError';

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
        '추가할 장소를 찾을 수 없습니다.',
        stepId,
      );
    }
    if (response.suggestions.length !== 1) {
      throw new TripCommandPlanError(
        'ambiguous_target',
        '추가할 장소 검색 결과가 하나로 결정되지 않았습니다.',
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
      '권한 있는 장소 정보를 불러올 수 없습니다.',
      stepId,
    );
  }
}
