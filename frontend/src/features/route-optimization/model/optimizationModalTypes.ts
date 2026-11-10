import { type TripDay } from '@trasolve/shared';
import type { RouteComparisonData } from '@/features/route-optimization/model/routeComparison';

export type Props = {
  id: string;
  days: readonly TripDay[];
  initialDayId?: string;
  onClose: () => void;
  onCompare: (data: RouteComparisonData) => void;
};
