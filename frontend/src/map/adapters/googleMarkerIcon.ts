import type { MapMarkerIcon } from '@/map/adapters/MapObjectController';

export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export function applyMarkerIcon(
  svg: SVGSVGElement,
  icon: MapMarkerIcon | undefined,
): void {
  svg.replaceChildren();
  svg.setAttribute('viewBox', icon?.viewBox ?? '0 0 24 24');
  for (const pathData of icon?.paths ?? []) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', pathData);
    svg.append(path);
  }
}
