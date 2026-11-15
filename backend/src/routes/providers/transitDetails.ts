import { z } from 'zod';
import type { MapRoute } from '@trasolve/shared';

const vehicleSchema = z.object({
  name: z.string().nullish(),
  type: z.union([z.string(), z.number()]).nullish(),
  color: z.string().nullish(),
  textColor: z.string().nullish(),
});

// tcache retains Kakao vehicles and Google transitLine/stopDetails verbatim.
export const upstreamTransitDetailsSchema = z.object({
  departureStop: z.string().nullish(),
  arrivalStop: z.string().nullish(),
  departureTime: z.string().nullish(),
  arrivalTime: z.string().nullish(),
  lineName: z.string().nullish(),
  lineShortName: z.string().nullish(),
  lineColor: z.string().nullish(),
  lineTextColor: z.string().nullish(),
  busType: z.string().nullish(),
  busTypeName: z.string().nullish(),
  headsign: z.string().nullish(),
  stopCount: z.number().int().nonnegative().nullish(),
  vehicleType: z.string().nullish(),
  stops: z.array(z.object({ name: z.string().nullish() })).nullish(),
  vehicles: z.array(vehicleSchema).nullish(),
  stopDetails: z
    .object({
      departureStop: z.object({ name: z.string().nullish() }).nullish(),
      arrivalStop: z.object({ name: z.string().nullish() }).nullish(),
      departureTime: z.string().nullish(),
      arrivalTime: z.string().nullish(),
    })
    .nullish(),
  transitLine: z
    .object({
      name: z.string().nullish(),
      nameShort: z.string().nullish(),
      color: z.string().nullish(),
      textColor: z.string().nullish(),
      vehicle: z.object({ type: z.string().nullish() }).nullish(),
    })
    .nullish(),
});

type Details = NonNullable<
  MapRoute['legs'][number]['steps'][number]['transitDetails']
>;

const busTypes: Readonly<Record<string, NonNullable<Details['busType']>>> = {
  간선: 'trunk',
  간선버스: 'trunk',
  TRUNK: 'trunk',
  지선: 'branch',
  지선버스: 'branch',
  BRANCH: 'branch',
  마을: 'local',
  마을버스: 'local',
  LOCAL: 'local',
  광역: 'rapid',
  광역버스: 'rapid',
  RAPID: 'rapid',
  순환: 'circulation',
  순환버스: 'circulation',
  CIRCULATION: 'circulation',
  공항: 'airport',
  공항버스: 'airport',
  AIRPORT: 'airport',
};

export function normalizeTransitDetails(
  details: z.infer<typeof upstreamTransitDetailsSchema> | null | undefined,
  fallbackVehicleType: string | null = null,
): Details | null {
  if (!details) {
    return null;
  }
  const line = details.transitLine;
  const stopDetails = details.stopDetails;
  const stops = details.stops?.flatMap((stop) =>
    stop.name ? [stop.name] : [],
  );
  const vehicle = details.vehicles?.[0];
  const vehicleType =
    details.vehicleType ?? line?.vehicle?.type ?? fallbackVehicleType;
  const rawType =
    details.busType ??
    details.busTypeName ??
    (vehicleType === 'BUS' && typeof vehicle?.type === 'string'
      ? vehicle.type
      : null);
  const busType = rawType
    ? (busTypes[rawType.replace(/\s/g, '').toUpperCase()] ?? null)
    : null;
  return {
    departureStop:
      details.departureStop ??
      stopDetails?.departureStop?.name ??
      stops?.at(0) ??
      null,
    arrivalStop:
      details.arrivalStop ??
      stopDetails?.arrivalStop?.name ??
      stops?.at(-1) ??
      null,
    departureTime: details.departureTime ?? stopDetails?.departureTime ?? null,
    arrivalTime: details.arrivalTime ?? stopDetails?.arrivalTime ?? null,
    lineName:
      details.lineName ??
      line?.name ??
      (!busType && typeof vehicle?.type === 'string' ? vehicle.type : null),
    lineShortName:
      details.lineShortName ?? line?.nameShort ?? vehicle?.name ?? null,
    lineColor: normalizeColor(
      details.lineColor ?? line?.color ?? vehicle?.color,
    ),
    lineTextColor: normalizeColor(
      details.lineTextColor ?? line?.textColor ?? vehicle?.textColor,
    ),
    busType,
    // Preserve an upstream display name; do not manufacture untranslated UI copy.
    busTypeName:
      details.busTypeName ??
      (busType && rawType && /[가-힣]/.test(rawType) ? rawType : null),
    headsign: details.headsign ?? null,
    stopCount:
      details.stopCount ??
      (stops?.length ? Math.max(0, stops.length - 1) : null),
    vehicleType: vehicleType ?? (busType ? 'BUS' : null),
  };
}

function normalizeColor(value: string | null | undefined): string | null {
  return value && /^#?[\da-f]{6}$/i.test(value)
    ? `#${value.replace(/^#/, '').toLowerCase()}`
    : null;
}
