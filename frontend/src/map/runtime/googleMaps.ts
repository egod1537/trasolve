import {
  GOOGLE_MAPS_DEFAULT_LANGUAGE_CODE,
  GOOGLE_MAPS_LANGUAGE_CODES,
  GOOGLE_MAPS_REGION_CODE,
  type GoogleMapsLanguageCode,
} from '@trasolve/shared';

// Browser SDK configuration and loading only; Web Service keys stay on the backend.
declare global {
  interface Window {
    trasolveMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

export const mapsConfig = {
  apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '',
  mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || 'DEMO_MAP_ID',
};

export const mapsAuthErrorEvent = 'trasolve:maps-auth-error';
const mapsScriptId = 'trasolve-google-maps-sdk';
let loading: Promise<void> | undefined;
let loadingLanguage: GoogleMapsLanguageCode | undefined;
let loadedLanguage: GoogleMapsLanguageCode | undefined;

export class GoogleMapsLocaleMismatchError extends Error {
  public constructor(
    public readonly loaded: GoogleMapsLanguageCode,
    public readonly requested: GoogleMapsLanguageCode,
  ) {
    super(`Google Maps is loaded for ${loaded}, but ${requested} was requested.`);
    this.name = 'GoogleMapsLocaleMismatchError';
  }
}

export function requiresGoogleMapsReload(
  language: GoogleMapsLanguageCode,
): boolean {
  const activeLanguage = getActiveLanguage();
  return activeLanguage !== undefined && activeLanguage !== language;
}

// One script per document, including React StrictMode remounts.
export function loadGoogleMaps(
  language: GoogleMapsLanguageCode = GOOGLE_MAPS_DEFAULT_LANGUAGE_CODE,
): Promise<void> {
  const activeLanguage = getActiveLanguage();
  if (activeLanguage && activeLanguage !== language) {
    return Promise.reject(
      new GoogleMapsLocaleMismatchError(activeLanguage, language),
    );
  }
  if (loading) {
    return loading;
  }
  if (loadedLanguage === language) {
    return Promise.resolve();
  }
  if (
    activeLanguage === language &&
    typeof google !== 'undefined' &&
    typeof google.maps?.importLibrary === 'function'
  ) {
    loadedLanguage = language;
    return Promise.resolve();
  }
  if (!mapsConfig.apiKey) {
    return Promise.reject(new Error('missing-key'));
  }

  loadingLanguage = language;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = mapsScriptId;
    script.dataset.trasolveLanguage = language;
    let settled = false;
    let timer = 0;
    const fail = (error: Error = new Error('maps-load-failed')) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      script.remove();
      loading = undefined;
      loadingLanguage = undefined;
      reject(error);
    };
    timer = window.setTimeout(() => fail(), 20000);
    window.trasolveMapsReady = () => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      loadedLanguage = language;
      loadingLanguage = undefined;
      resolve();
    };
    window.gm_authFailure = () => {
      fail(new Error('maps-auth-failed'));
      window.dispatchEvent(new Event(mapsAuthErrorEvent));
    };
    const params = new URLSearchParams({
      key: mapsConfig.apiKey,
      callback: 'trasolveMapsReady',
      loading: 'async',
      v: 'weekly',
      language,
      region: GOOGLE_MAPS_REGION_CODE,
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => fail();
    document.head.append(script);
  });
  return loading;
}

function getActiveLanguage(): GoogleMapsLanguageCode | undefined {
  if (loadedLanguage ?? loadingLanguage) {
    return loadedLanguage ?? loadingLanguage;
  }
  const language = document.getElementById(mapsScriptId)?.dataset
    .trasolveLanguage;
  return GOOGLE_MAPS_LANGUAGE_CODES.find((candidate) => candidate === language);
}
