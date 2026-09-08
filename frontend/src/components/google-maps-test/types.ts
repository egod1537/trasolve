import type { LatLng } from '../google-map/types';

export type Endpoint = { text: string; location?: LatLng };
export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';
