/// <reference types="google.maps" />

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
let loading: Promise<void> | undefined;

// One script per document, including React StrictMode remounts.
export function loadGoogleMaps(): Promise<void> {
  if (loading) return loading;
  if (!mapsConfig.apiKey) return Promise.reject(new Error('missing-key'));

  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => fail(), 20000);
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error('maps-load-failed'));
    };
    window.trasolveMapsReady = () => {
      window.clearTimeout(timer);
      resolve();
    };
    window.gm_authFailure = () => {
      fail();
      window.dispatchEvent(new Event(mapsAuthErrorEvent));
    };
    const params = new URLSearchParams({
      key: mapsConfig.apiKey,
      callback: 'trasolveMapsReady',
      loading: 'async',
      v: 'weekly',
      language: 'ko',
      region: 'JP',
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
