import type { TripPlace } from '@trasolve/shared';
import { useId, useMemo } from 'react';
import {
  RouteComparisonMap,
  RouteComparisonPlaceholder,
} from '@/features/route-optimization/ui/RouteComparisonMap';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon } from '@/shared/ui/icons';

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
          <h2 id={titleId}>경로 지도 비교</h2>
          <p id={descriptionId}>{dayTitle}의 방문 순서를 비교합니다.</p>
        </div>
        <IconButton
          aria-label="경로 지도 비교 닫기"
          icon={<CloseIcon />}
          variant="ghost"
          size="sm"
          onClick={onClose}
        />
      </header>
      <div className="route-map-comparison-grid">
        <RouteComparisonMap
          title="Before"
          heading="Before"
          ariaLabel={`${dayTitle} 현재 방문 순서 확대 지도`}
          layer={`route-optimization-expanded-before-${dayId}`}
          places={beforePlaces}
          viewportPlaces={viewportPlaces}
          selectedStartPlaceId={selectedStartPlaceId}
          selectedEndPlaceId={selectedEndPlaceId}
        />
        {hasAfter ? (
          <RouteComparisonMap
            title="After"
            heading="After"
            ariaLabel={`${dayTitle} 최적화 방문 순서 확대 지도`}
            layer={`route-optimization-expanded-after-${dayId}`}
            places={afterPlaces}
            viewportPlaces={viewportPlaces}
            selectedStartPlaceId={selectedStartPlaceId}
            selectedEndPlaceId={selectedEndPlaceId}
          />
        ) : (
          <RouteComparisonPlaceholder
            heading="After"
            message="아직 최적화를 실행하지 않았습니다."
          />
        )}
      </div>
    </Dialog>
  );
}
