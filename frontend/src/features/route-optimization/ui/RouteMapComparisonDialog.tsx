import type { TripPlace } from '@trasolve/shared';
import { useId, useMemo } from 'react';
import {
  RouteComparisonMap,
  RouteComparisonPlaceholder,
} from '@/features/route-optimization/ui/RouteComparisonMap';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';
import { useL } from '@/shared/i18n';

type Props = {
  dayId: string;
  dayTitle: string;
  beforePlaces: readonly TripPlace[];
  afterPlaces: readonly TripPlace[];
  hasAfter: boolean;
  selectedStartPlaceId: string;
  selectedEndPlaceId: string;
  onClose: () => void;
};

export function RouteMapComparisonDialog({
  dayId,
  dayTitle,
  beforePlaces,
  afterPlaces,
  hasAfter,
  selectedStartPlaceId,
  selectedEndPlaceId,
  onClose,
}: Props) {
  const L = useL();
  const titleId = useId();
  const descriptionId = useId();
  const viewportPlaces = useMemo(
    () =>
      Array.from(
        new Map(
          [...beforePlaces, ...afterPlaces].map((place) => [place.id, place]),
        ).values(),
      ),
    [afterPlaces, beforePlaces],
  );

  return (
    <Dialog
      className="route-map-comparison-dialog"
      backdropClassName="route-map-comparison-backdrop"
      labelledBy={titleId}
      describedBy={descriptionId}
      onClose={onClose}
    >
      <header className="route-map-comparison-header">
        <div>
          <h2 id={titleId}>
            {L(
              'routeOptimization:routeMapComparisonDialog.title.routeMapComparison',
            )}
          </h2>
          <p id={descriptionId}>
            {L(
              'routeOptimization:routeMapComparisonDialog.text.comparesVisitOrder',
              { dayTitle: dayTitle },
            )}
          </p>
        </div>
        <IconButton
          aria-label={L(
            'routeOptimization:routeMapComparisonDialog.ariaLabel.closeRouteMapComparison',
          )}
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
      </header>
      <div className="route-map-comparison-grid">
        <RouteComparisonMap
          phase="before"
          heading={L('routeOptimization:comparison.label.before')}
          ariaLabel={L(
            'routeOptimization:routeMapComparisonDialog.ariaLabel.currentVisitOrderExpandedMap',
            { dayTitle: dayTitle },
          )}
          layer={`route-optimization-expanded-before-${dayId}`}
          places={beforePlaces}
          viewportPlaces={viewportPlaces}
          selectedStartPlaceId={selectedStartPlaceId}
          selectedEndPlaceId={selectedEndPlaceId}
        />
        {hasAfter ? (
          <RouteComparisonMap
            phase="after"
            heading={L('routeOptimization:comparison.label.after')}
            ariaLabel={L(
              'routeOptimization:routeMapComparisonDialog.ariaLabel.optimizedVisitOrderExpansionMap',
              { dayTitle: dayTitle },
            )}
            layer={`route-optimization-expanded-after-${dayId}`}
            places={afterPlaces}
            viewportPlaces={viewportPlaces}
            selectedStartPlaceId={selectedStartPlaceId}
            selectedEndPlaceId={selectedEndPlaceId}
          />
        ) : (
          <RouteComparisonPlaceholder
            heading={L('routeOptimization:comparison.label.after')}
            message={L(
              'routeOptimization:routeMapComparisonDialog.text.noOptimizationHasBeenRunYet',
            )}
          />
        )}
      </div>
    </Dialog>
  );
}
