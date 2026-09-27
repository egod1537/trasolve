import {
  TravelMode,
  type DirectionsRequest,
  type MapRoute,
  type RouteLocation,
} from '@trasolve/shared';
import { getLanguage, L, NL } from '@/shared/i18n';

const notAvailable = (): string =>
  L('testbed:routeResultModel.nOTAVAILABLE.text.notProvided');

const vehicleLabels: Readonly<Record<string, string>> = {
  get BUS() {
    return L('testbed:routeResultModel.vehicleLabels.text.bus');
  },
  get CABLE_CAR() {
    return L('testbed:routeResultModel.vehicleLabels.text.cableCar');
  },
  get COMMUTER_TRAIN() {
    return L('testbed:routeResultModel.vehicleLabels.text.train');
  },
  get FERRY() {
    return L('testbed:routeResultModel.vehicleLabels.text.ferry');
  },
  get FUNICULAR() {
    return L('testbed:routeResultModel.vehicleLabels.text.funicular');
  },
  get GONDOLA_LIFT() {
    return L('testbed:routeResultModel.vehicleLabels.text.gondola');
  },
  get HEAVY_RAIL() {
    return L('testbed:routeResultModel.vehicleLabels.text.railway');
  },
  get HIGH_SPEED_TRAIN() {
    return L('testbed:routeResultModel.vehicleLabels.text.highSpeedRail');
  },
  get INTERCITY_BUS() {
    return L('testbed:routeResultModel.vehicleLabels.text.intercityBus');
  },
  get LONG_DISTANCE_TRAIN() {
    return L('testbed:routeResultModel.vehicleLabels.text.longDistanceTrain');
  },
  get METRO_RAIL() {
    return L('testbed:routeResultModel.vehicleLabels.text.subway');
  },
  get MONORAIL() {
    return L('testbed:routeResultModel.vehicleLabels.text.monorail');
  },
  get RAIL() {
    return L('testbed:routeResultModel.vehicleLabels.text.railway');
  },
  get SHARE_TAXI() {
    return L('testbed:routeResultModel.vehicleLabels.text.sharedTaxi');
  },
  get SUBWAY() {
    return L('testbed:routeResultModel.vehicleLabels.text.subway');
  },
  get TRAM() {
    return L('testbed:routeResultModel.vehicleLabels.text.tram');
  },
  get TROLLEYBUS() {
    return L('testbed:routeResultModel.vehicleLabels.text.trolleybus');
  },
};

export type RouteSummaryModel = {
  duration: string;
  distance: string;
  fare: string;
  travelModes: string;
};

export type ItineraryStepModel = {
  key: string;
  modeLabel: string;
  title: string;
  details: string[];
  stopLabel: string | null;
  headsign: string | null;
  instruction: string | null;
};

export type ItineraryEndpointModel = {
  title: string;
  location: string;
};

export type ItineraryLegModel = {
  key: string;
  start: ItineraryEndpointModel;
  end: ItineraryEndpointModel;
  steps: ItineraryStepModel[];
};

export function formatDistance(meters: number | null): string {
  if (meters === null) {
    return notAvailable();
  }
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString(getLanguage())} ${NL('m')}`;
  }
  return `${new Intl.NumberFormat(getLanguage(), {
    maximumFractionDigits: 1,
  }).format(meters / 1000)} ${NL('km')}`;
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) {
    return notAvailable();
  }
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) {
    return L('testbed:routeResultModel.formatDuration.text.minutes', {
      minutes: minutes,
    });
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes
    ? L('testbed:routeResultModel.formatDuration.text.hoursMinutes', {
        hours: hours,
        remainingMinutes: remainingMinutes,
      })
    : L('testbed:routeResultModel.formatDuration.text.hours', { hours: hours });
}

export function formatFare(fare: MapRoute['fare']): string {
  if (!fare) {
    return notAvailable();
  }
  try {
    return new Intl.NumberFormat(getLanguage(), {
      style: 'currency',
      currency: fare.currencyCode,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: fare.amount % 1 === 0 ? 0 : 2,
    }).format(fare.amount);
  } catch {
    return `${fare.amount.toLocaleString(getLanguage())} ${fare.currencyCode}`;
  }
}

export function getTravelModeLabel(
  travelMode: string | null | undefined,
  vehicleType?: string | null,
): string {
  if (travelMode === 'TRANSIT' && vehicleType) {
    return (
      vehicleLabels[vehicleType] ??
      L('testbed:tcacheRouteOptions.mODES.label.publicTransportation')
    );
  }
  switch (travelMode) {
    case 'DRIVE':
    case TravelMode.DRIVING:
      return L('testbed:tcacheRouteOptions.mODES.label.car');
    case 'WALK':
    case TravelMode.WALKING:
      return L('testbed:tcacheRouteOptions.mODES.label.walk');
    case 'BICYCLE':
    case TravelMode.BICYCLING:
      return L('testbed:tcacheRouteOptions.mODES.label.bicycle');
    case 'TWO_WHEELER':
      return L('testbed:routeResultModel.getTravelModeLabel.text.twoWheeler');
    case 'TRANSIT':
      return L('testbed:tcacheRouteOptions.mODES.label.publicTransportation');
    default:
      return L('testbed:routeResultModel.getTravelModeLabel.text.move');
  }
}

export function buildRouteSummary(
  route: MapRoute,
  fallbackTravelMode: TravelMode | undefined,
): RouteSummaryModel {
  const modes = route.legs.flatMap((leg) =>
    leg.steps.map((step) =>
      getTravelModeLabel(
        step.travelMode ?? fallbackTravelMode,
        step.transitDetails?.vehicleType,
      ),
    ),
  );
  const travelModes = [
    ...new Set(
      modes.length
        ? modes
        : [getTravelModeLabel(fallbackTravelMode ?? TravelMode.DRIVING)],
    ),
  ].join(' + ');
  return {
    duration: formatDuration(route.durationMillis),
    distance: formatDistance(route.distanceMeters),
    fare: formatFare(route.fare),
    travelModes,
  };
}

export function buildRouteItinerary(
  route: MapRoute,
  request: DirectionsRequest,
): ItineraryLegModel[] {
  const locations = [
    request.origin,
    ...(request.intermediates ?? []),
    request.destination,
  ];
  const legs = route.legs.length
    ? route.legs
    : [
        {
          distanceMeters: route.distanceMeters,
          durationMillis: route.durationMillis,
          startLocation: null,
          endLocation: null,
          steps: [],
        },
      ];

  return legs.map((leg, legIndex) => {
    const steps = leg.steps.length
      ? leg.steps
      : [
          {
            travelMode: request.travelMode ?? TravelMode.DRIVING,
            distanceMeters: leg.distanceMeters,
            durationMillis: leg.durationMillis,
            instruction: null,
            startLocation: leg.startLocation,
            endLocation: leg.endLocation,
            transitDetails: null,
          },
        ];
    return {
      key: `leg-${legIndex}`,
      start: buildEndpoint(locations[legIndex], legIndex, locations.length),
      end: buildEndpoint(
        locations[legIndex + 1],
        legIndex + 1,
        locations.length,
      ),
      steps: steps.map((step, stepIndex) => {
        const transit = step.transitDetails;
        const modeLabel = getTravelModeLabel(
          step.travelMode ?? request.travelMode,
          transit?.vehicleType,
        );
        const lineNames = [transit?.lineShortName, transit?.lineName].filter(
          (value, index, values): value is string =>
            Boolean(value) && values.indexOf(value) === index,
        );
        const departureTime = formatTransitTime(transit?.departureTime);
        const arrivalTime = formatTransitTime(transit?.arrivalTime);
        const details = [
          formatDuration(step.durationMillis),
          formatDistance(step.distanceMeters),
          transit?.stopCount === null || transit?.stopCount === undefined
            ? null
            : L('testbed:routeResultModel.buildRouteItinerary.text.stops', {
                stopCount: transit.stopCount,
              }),
          departureTime || arrivalTime
            ? `${departureTime ? L('testbed:routeResultModel.buildRouteItinerary.text.departure', { departureTime: departureTime }) : ''}${departureTime && arrivalTime ? ' · ' : ''}${arrivalTime ? L('testbed:routeResultModel.buildRouteItinerary.text.arrival', { arrivalTime: arrivalTime }) : ''}`
            : null,
        ].filter((value): value is string => value !== null);
        return {
          key: `leg-${legIndex}-step-${stepIndex}`,
          modeLabel,
          title: lineNames.join(' · ') || modeLabel,
          details,
          stopLabel:
            transit?.departureStop || transit?.arrivalStop
              ? `${transit.departureStop ?? L('testbed:routeResultModel.buildRouteItinerary.text.boardingStationUnknown')} → ${transit.arrivalStop ?? L('testbed:routeResultModel.buildRouteItinerary.text.dropOffStationUnknown')}`
              : null,
          headsign: transit?.headsign
            ? L('testbed:routeResultModel.buildRouteItinerary.text.towards', {
                headsign: transit.headsign,
              })
            : null,
          instruction: step.instruction,
        };
      }),
    };
  });
}

function formatTransitTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.match(/T(\d{2}:\d{2})/)?.[1] ?? value;
}

function buildEndpoint(
  location: RouteLocation | undefined,
  index: number,
  locationCount: number,
): ItineraryEndpointModel {
  return {
    title:
      index === 0
        ? L('testbed:jobResultMapComparison.locationSequence.label.departure')
        : index === locationCount - 1
          ? L('testbed:jobResultMapComparison.locationSequence.label.arrival')
          : L('testbed:directionsPanel.text.waypoint', { value: index }),
    location: formatRouteLocation(location),
  };
}

function formatRouteLocation(location: RouteLocation | undefined): string {
  if (!location) {
    return notAvailable();
  }
  switch (location.type) {
    case 'address':
      return location.address;
    case 'place':
      return `${NL('Place ID')} · ${location.placeId}`;
    case 'coordinates':
      return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  }
}
