import { PolylineModeIcon } from './PolylineModeIcon';

export function TransitVehicleIcon({
  vehicleType,
}: {
  vehicleType?: string | null;
}) {
  if (
    vehicleType !== 'BUS' &&
    vehicleType !== 'INTERCITY_BUS' &&
    vehicleType !== 'TROLLEYBUS'
  ) {
    return <PolylineModeIcon mode="transit" />;
  }
  return (
    <svg className="polyline-mode-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="16" rx="3" />
      <path d="M5 12h14M8 6h8M8 19v2M16 19v2" />
      <circle cx="8.5" cy="15.5" r="1" />
      <circle cx="15.5" cy="15.5" r="1" />
    </svg>
  );
}
