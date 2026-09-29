import {
  API_ROUTES,
  getGoogleMapsLocale,
  placeAutocompleteRequestSchema,
  placeAutocompleteResponseSchema,
  placeDetailsRequestSchema,
  placeDetailsSchema,
  type PlaceAutocompleteRequest,
  type PlaceAutocompleteResponse,
  type PlaceDetails,
  type PlaceDetailsRequest,
} from '@trasolve/shared';
import { getLanguage, L } from '@/shared/i18n';

type SearchOptions = Omit<PlaceAutocompleteRequest, 'input'> & {
  signal?: AbortSignal;
};
type DetailsOptions = Omit<PlaceDetailsRequest, 'placeId'> & {
  signal?: AbortSignal;
};

async function requestPlaces(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(20000);
  const response = await fetch(url, {
    ...init,
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      L('errors:places.error.placeLookupFailedHttp', {
        status: response.status,
      }),
    );
  }
  return body;
}

export async function searchPlaces(
  input: string,
  { signal, ...options }: SearchOptions = {},
): Promise<PlaceAutocompleteResponse> {
  const request = placeAutocompleteRequestSchema.parse({
    input,
    ...options,
    ...getGoogleMapsLocale(getLanguage()),
  });
  const body = await requestPlaces(
    API_ROUTES.placesAutocomplete,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    signal,
  );
  const parsed = placeAutocompleteResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      L('errors:places.error.placeSearchResponseFormatIncorrect'),
    );
  }
  return parsed.data;
}

export async function getPlace(
  placeId: string,
  { signal, ...options }: DetailsOptions = {},
): Promise<PlaceDetails> {
  const request = placeDetailsRequestSchema.parse({
    placeId,
    ...options,
    ...getGoogleMapsLocale(getLanguage()),
  });
  const query = new URLSearchParams();
  if (request.languageCode) {
    query.set('languageCode', request.languageCode);
  }
  if (request.regionCode) {
    query.set('regionCode', request.regionCode);
  }
  if (request.sessionToken) {
    query.set('sessionToken', request.sessionToken);
  }
  const body = await requestPlaces(
    `${API_ROUTES.places}/${encodeURIComponent(request.placeId)}?${query}`,
    { method: 'GET' },
    signal,
  );
  const parsed = placeDetailsSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(
      L('errors:places.error.venueDetailResponseFormatIncorrect'),
    );
  }
  return parsed.data;
}
