import type { TripDay, TrouteTravelMode } from '@trasolve/shared';
import { L, type Localize } from '@/shared/i18n';
import {
  getRouteOptimizationTravelMode,
  type RouteOptimizationIssue,
  type RouteOptimizationRequestOptions,
  type RouteOptimizationStartPolicy,
} from '@/features/route-optimization/model/routeOptimization';

export const TRAVEL_MODE_OPTIONS: readonly {
  value: TrouteTravelMode;
  label: string;
}[] = [
  {
    value: 'TRANSIT',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.publicTransportation',
      );
    },
  },
  {
    value: 'DRIVING',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.car',
      );
    },
  },
  {
    value: 'WALKING',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.walk',
      );
    },
  },
  {
    value: 'BICYCLING',
    get label() {
      return L(
        'routeOptimization:routeOptimizationModal.tRAVELMODEOPTIONS.label.bicycle',
      );
    },
  },
];

export const START_POLICY_OPTIONS: readonly {
  value: RouteOptimizationStartPolicy;
  label: string;
}[] = [
  {
    value: 'fixed',
    get label() {
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.designatedTime',
      );
    },
  },
  {
    value: 'earliest',
    get label() {
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.asSoonAsPossible',
      );
    },
  },
  {
    value: 'latest',
    get label() {
      return L(
        'routeOptimization:routeOptimizationApi.formatStartPolicy.text.asLateAsPossible',
      );
    },
  },
];

export function formatRouteOptimizationIssue(
  issue: RouteOptimizationIssue,
  L: Localize,
): string {
  switch (issue.code) {
    case 'minimumPlaces':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.routeOptimizationRequiresTwoMoreLocations',
        issue.values,
      );
    case 'startOutsideDay':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.startingPointMustBeLocationIncluded',
        issue.values,
      );
    case 'endOutsideDay':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.endpointMustBeLocationIncludedCurrent',
        issue.values,
      );
    case 'sameEndpoints':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.startingEndingPointsMustBeDifferent',
        issue.values,
      );
    case 'unsupportedStartPolicy':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.thisStartupMethodNotSupported',
        issue.values,
      );
    case 'fixedStartRequired':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.specifiedTimeStartRequiresStartTime',
        issue.values,
      );
    case 'fixedStartStep':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.specifiedStartTimeMustBe10',
        issue.values,
      );
    case 'unsupportedTravelMode':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.thisTransportationMethodNotSupported',
        issue.values,
      );
    case 'missingPlaceId':
      return L(
        'routeOptimization:routeOptimization.getRouteOptimizationIssue.text.placeIdRequiredCheckActualTravel',
        issue.values,
      );
    case 'invalidRequest':
      return L(
        'routeOptimization:routeOptimization.error.routeOptimizationRequestValueIncorrect',
        issue.values,
      );
    case 'stayStep':
      return L(
        'routeOptimization:routeOptimization.getLocationConstraint.text.stayTimeMustBe10Minute',
        issue.values,
      );
    case 'nextDayOpeningHours':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.nextBusinessHoursNotCurrentlySupported',
        issue.values,
      );
    case 'noOpeningHours':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.hasNoValidBusinessHoursSelected',
        issue.values,
      );
    case 'openingTimeStep':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.openingTimeMustBe10Minute',
        issue.values,
      );
    case 'closingTimeStep':
      return L(
        'routeOptimization:routeOptimization.getOpeningWindow.text.closingTimeMustBe10Minute',
        issue.values,
      );
  }
}

export function createDayOptimizationSettings(
  day: TripDay,
): RouteOptimizationRequestOptions {
  const orderedPlaces = [...day.places].sort(
    (left, right) => left.order - right.order,
  );
  return {
    selectedStartPlaceId: orderedPlaces[0]?.id ?? '',
    selectedEndPlaceId: orderedPlaces.at(-1)?.id ?? '',
    startPolicy: 'earliest',
    startTime: null,
    travelMode: getRouteOptimizationTravelMode(day),
    visitPolicy: 'all-required',
    placePreferences: {},
  };
}
