import {
  directionsDebugDetailsSchema,
  type DirectionsRequest,
  type DirectionsResult,
} from '@trasolve/shared';
import type { RouteProvider } from './routeProvider.js';

export class RouteService {
  public constructor(private readonly provider: RouteProvider) {}

  public async queryRoutes(
    request: DirectionsRequest,
  ): Promise<DirectionsResult> {
    const result = await this.provider.queryRoutes(request);
    const debug = directionsDebugDetailsSchema.safeParse(
      result.diagnostics?.debugDetails,
    );
    return {
      request,
      routes: result.routes,
      ...(result.diagnostics?.rawResponse === undefined
        ? {}
        : { rawResponse: result.diagnostics.rawResponse }),
      ...(debug.success ? { debug: debug.data } : {}),
    };
  }
}
