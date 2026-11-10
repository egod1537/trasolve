import { getDirections } from '@/shared/api/routes';
import type { QueryRouteDetails } from '../domain/routeDetails';

export const queryRouteDetails: QueryRouteDetails = async (request, signal) => {
  const result = await getDirections(
    { ...request, computeAlternativeRoutes: true },
    signal,
  );
  return result.routes;
};
