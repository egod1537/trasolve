import type { PlaceStyleType } from '@trasolve/shared';
import { getPlaceStyleOption } from '../domain/placeStyle';

type Props = {
  type: PlaceStyleType;
  className?: string;
};

export function PlaceStyleIcon({ type, className }: Props) {
  const icon = getPlaceStyleOption(type).icon;

  return (
    <svg
      className={className}
      viewBox={icon.viewBox}
      fill="none"
      aria-hidden="true"
    >
      {icon.paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
