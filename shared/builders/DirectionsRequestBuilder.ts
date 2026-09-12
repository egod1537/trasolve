import { directionsRequestSchema } from '../schemas/routes.js';
import type {
  DirectionsRequest,
  RouteLocation,
  TravelMode,
} from '../types/routes.js';

export class DirectionsRequestBuilder {
  public constructor() {
    this.request = {};
  }

  public setOrigin(origin: RouteLocation): this {
    this.request.origin = { ...origin };
    return this;
  }

  public setDestination(destination: RouteLocation): this {
    this.request.destination = { ...destination };
    return this;
  }

  public setTravelMode(travelMode: TravelMode): this {
    this.request.travelMode = travelMode;
    return this;
  }

  public setIntermediates(intermediates: readonly RouteLocation[]): this {
    this.request.intermediates = intermediates.map((location) => ({
      ...location,
    }));
    return this;
  }

  public setComputeAlternativeRoutes(computeAlternativeRoutes: boolean): this {
    this.request.computeAlternativeRoutes = computeAlternativeRoutes;
    return this;
  }

  /** Validates required endpoints and route constraints; throws ZodError on invalid input. */
  public build(): DirectionsRequest {
    return directionsRequestSchema.parse(this.request);
  }

  private readonly request: Partial<DirectionsRequest>;
}
