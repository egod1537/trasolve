import {
  TravelMode,
  type DirectionsRequest,
  type MapRoute,
  type RouteLocation,
} from '@trasolve/shared';

const NOT_AVAILABLE = '제공되지 않음';

const vehicleLabels: Readonly<Record<string, string>> = {
  BUS: '버스',
  CABLE_CAR: '케이블카',
  COMMUTER_TRAIN: '전철',
  FERRY: '페리',
  FUNICULAR: '푸니쿨라',
  GONDOLA_LIFT: '곤돌라',
  HEAVY_RAIL: '철도',
  HIGH_SPEED_TRAIN: '고속철도',
  INTERCITY_BUS: '시외버스',
  LONG_DISTANCE_TRAIN: '장거리 열차',
  METRO_RAIL: '지하철',
  MONORAIL: '모노레일',
  RAIL: '철도',
  SHARE_TAXI: '합승 택시',
  SUBWAY: '지하철',
  TRAM: '트램',
  TROLLEYBUS: '트롤리버스',
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
    return NOT_AVAILABLE;
  }
  if (meters < 1000) {
    return `${Math.round(meters).toLocaleString('ko-KR')} m`;
  }
  return `${new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
  }).format(meters / 1000)} km`;
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) {
    return NOT_AVAILABLE;
  }
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) {
    return `${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes
    ? `${hours}시간 ${remainingMinutes}분`
    : `${hours}시간`;
}

export function formatFare(fare: MapRoute['fare']): string {
  if (!fare) {
    return NOT_AVAILABLE;
  }
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: fare.currencyCode,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: fare.amount % 1 === 0 ? 0 : 2,
    }).format(fare.amount);
  } catch {
    return `${fare.amount.toLocaleString('ko-KR')} ${fare.currencyCode}`;
  }
}

export function getTravelModeLabel(
  travelMode: string | null | undefined,
  vehicleType?: string | null,
): string {
  if (travelMode === 'TRANSIT' && vehicleType) {
    return vehicleLabels[vehicleType] ?? '대중교통';
  }
  switch (travelMode) {
    case 'DRIVE':
    case TravelMode.DRIVING:
      return '자동차';
    case 'WALK':
    case TravelMode.WALKING:
      return '도보';
    case 'BICYCLE':
    case TravelMode.BICYCLING:
      return '자전거';
    case 'TWO_WHEELER':
      return '이륜차';
    case 'TRANSIT':
      return '대중교통';
    default:
      return '이동';
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
            : `${transit.stopCount}정거장`,
          departureTime || arrivalTime
            ? `${departureTime ? `${departureTime} 출발` : ''}${departureTime && arrivalTime ? ' · ' : ''}${arrivalTime ? `${arrivalTime} 도착` : ''}`
            : null,
        ].filter((value): value is string => value !== null);
        return {
          key: `leg-${legIndex}-step-${stepIndex}`,
          modeLabel,
          title: lineNames.join(' · ') || modeLabel,
          details,
          stopLabel:
            transit?.departureStop || transit?.arrivalStop
              ? `${transit.departureStop ?? '승차역 미상'} → ${transit.arrivalStop ?? '하차역 미상'}`
              : null,
          headsign: transit?.headsign ? `${transit.headsign} 방면` : null,
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
        ? '출발'
        : index === locationCount - 1
          ? '도착'
          : `경유지 ${index}`,
    location: formatRouteLocation(location),
  };
}

function formatRouteLocation(location: RouteLocation | undefined): string {
  if (!location) {
    return NOT_AVAILABLE;
  }
  switch (location.type) {
    case 'address':
      return location.address;
    case 'place':
      return `Place ID · ${location.placeId}`;
    case 'coordinates':
      return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  }
}
