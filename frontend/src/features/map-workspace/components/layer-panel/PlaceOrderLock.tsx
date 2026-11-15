import { PinIcon } from '@/shared/ui/icons';
import { useL } from '@/shared/i18n';

export function PlaceOrderLock({
  placeId,
  locked,
  onChange,
  onBeforeChange,
}: {
  placeId: string;
  locked: boolean;
  onChange: (placeId: string, locked: boolean) => void;
  onBeforeChange: () => void;
}) {
  const L = useL();
  const label = L(
    'routeOptimization:routeComparisonMap.text.currentVisitOrder',
  );
  return (
    <button
      type="button"
      className="trip-place-order-lock"
      aria-label={label}
      aria-describedby={`place-name-${placeId}`}
      aria-pressed={locked}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onBeforeChange();
        onChange(placeId, !locked);
      }}
    >
      <PinIcon />
    </button>
  );
}
