import type { DirectionsRequest, MapRoute } from '@trasolve/shared';

export interface RouteProviderDiagnostics {
  rawResponse?: unknown;
  debugDetails?: unknown;
}

export interface RouteProviderResult {
  routes: MapRoute[];
  diagnostics?: RouteProviderDiagnostics;
}

export interface RouteProvider {
  queryRoutes(request: DirectionsRequest): Promise<RouteProviderResult>;
}
