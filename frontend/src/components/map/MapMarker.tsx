import { useEffect, useRef } from 'react';
import type { TripPlace } from '../../types/trip';

type Props = {
  map: google.maps.Map;
  markerLibrary: google.maps.MarkerLibrary;
  place: TripPlace;
  dayTitle: string;
  color: string;
  selected: boolean;
  onSelect: (placeId: string) => void;
};

export function MapMarker({
  map,
  markerLibrary,
  place,
  dayTitle,
  color,
  selected,
  onSelect,
}: Props) {
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null,
  );
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const content = document.createElement('div');
    content.className = 'trip-map-marker';
    content.style.setProperty('--day-color', color);
    content.textContent = String(place.order);
    const marker = new markerLibrary.AdvancedMarkerElement({
      map,
      position: { lat: place.lat, lng: place.lng },
      title: `${dayTitle} · ${place.order}. ${place.name}`,
    });
    marker.append(content);
    const listener = marker.addListener('click', () => onSelect(place.id));
    markerRef.current = marker;
    contentRef.current = content;
    return () => {
      listener.remove();
      marker.map = null;
      markerRef.current = null;
      contentRef.current = null;
    };
  }, [map, markerLibrary, place, dayTitle, color, onSelect]);

  useEffect(() => {
    contentRef.current?.classList.toggle('is-selected', selected);
    if (markerRef.current)
      markerRef.current.zIndex = selected ? 1000 : place.order;
  }, [
    selected,
    place.order,
    map,
    markerLibrary,
    place,
    dayTitle,
    color,
    onSelect,
  ]);

  return null;
}
