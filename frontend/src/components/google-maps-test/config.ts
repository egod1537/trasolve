import type { GoogleMapOptions, LatLng } from '../google-map/types';

export const initialCenter: LatLng = { lat: 35.6812, lng: 139.7671 };
export const initialZoom = 12;
export const routePadding = { top: 48, right: 48, bottom: 48, left: 48 };
export const mapOptions: GoogleMapOptions = {
  zoomControl: true,
  fullscreenControl: true,
};
