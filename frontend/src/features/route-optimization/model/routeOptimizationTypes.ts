import { type TrouteTravelMode, type TripDay } from '@trasolve/shared';

export type RouteOptimizationDay = TripDay & {
  minimumStartTime?: string;
  startTime?: string;
  travelMode?: string;
};

export type RouteOptimizationStartPolicy = 'fixed' | 'earliest' | 'latest';

export type RouteOptimizationVisitPolicy =
  'all-required' | 'best-effort-on-failure';

export type RouteOptimizationPlacePreference = {
  required: boolean;
  priority: number;
};

export type RouteOptimizationRequestOptions = {
  selectedStartPlaceId: string;
  selectedEndPlaceId: string;
  startPolicy: RouteOptimizationStartPolicy;
  startTime: string | null;
  travelMode: TrouteTravelMode;
  visitPolicy: RouteOptimizationVisitPolicy;
  placePreferences: Readonly<Record<string, RouteOptimizationPlacePreference>>;
};

export type LocationConstraint = {
  openTime: string;
  closeTime: string;
  stayMinutes: number;
  usedOpeningHoursFallback: boolean;
  issue: RouteOptimizationIssue | null;
};

export type RouteOptimizationIssue = {
  code:
    | 'minimumPlaces'
    | 'startOutsideDay'
    | 'endOutsideDay'
    | 'sameEndpoints'
    | 'unsupportedStartPolicy'
    | 'fixedStartRequired'
    | 'fixedStartStep'
    | 'unsupportedTravelMode'
    | 'missingPlaceId'
    | 'invalidRequest'
    | 'stayStep'
    | 'nextDayOpeningHours'
    | 'noOpeningHours'
    | 'openingTimeStep'
    | 'closingTimeStep';
  values?: Record<string, string | number>;
};

export class RouteOptimizationValidationError extends Error {
  public constructor(public readonly issue: RouteOptimizationIssue) {
    super(issue.code);
    this.name = 'RouteOptimizationValidationError';
  }
}

export type RouteOptimizationDiagnostics = {
  openingHoursFallback: boolean;
  openingHoursFallbackPlaceIds: readonly string[];
  openingHoursFallbackPlaceNames: readonly string[];
};

export type RouteOptimizationScheduleStop = {
  placeId: string;
  arrivalTime: string;
  serviceStartTime: string;
  departureTime: string;
  travelMinutesFromPrevious: number | null;
  waitMinutes: number;
  stayMinutes: number;
  syncStayMinutes: boolean;
};

export type RouteOptimizationSchedule = {
  placeIds: readonly string[];
  stops: readonly RouteOptimizationScheduleStop[];
};
