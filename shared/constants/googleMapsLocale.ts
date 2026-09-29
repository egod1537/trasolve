export const GOOGLE_MAPS_LANGUAGE_CODES = ['ko', 'ja', 'en', 'mn'] as const;
export const GOOGLE_MAPS_DEFAULT_LANGUAGE_CODE = 'ko' as const;
export const GOOGLE_MAPS_REGION_CODE = 'JP' as const;

export type GoogleMapsLanguageCode =
  (typeof GOOGLE_MAPS_LANGUAGE_CODES)[number];
export type GoogleMapsRegionCode = typeof GOOGLE_MAPS_REGION_CODE;

export type GoogleMapsLocale = {
  languageCode: GoogleMapsLanguageCode;
  regionCode: GoogleMapsRegionCode;
};

export function getGoogleMapsLocale(
  languageCode: GoogleMapsLanguageCode,
): GoogleMapsLocale {
  return { languageCode, regionCode: GOOGLE_MAPS_REGION_CODE };
}
