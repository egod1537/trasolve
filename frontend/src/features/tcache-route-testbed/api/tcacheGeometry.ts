import {
  readOptionalString,
  readOptionalNumber,
  isRecord,
} from '@/features/tcache-route-testbed/api/tcacheContract';

export function parseBounds(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }
  const north = readOptionalNumber(value, ['north']);
  const south = readOptionalNumber(value, ['south']);
  const east = readOptionalNumber(value, ['east']);
  const west = readOptionalNumber(value, ['west']);
  if (
    north !== undefined &&
    south !== undefined &&
    east !== undefined &&
    west !== undefined
  ) {
    return { north, south, east, west };
  }
  const northeast = parsePoint(value.northeast ?? value.high);
  const southwest = parsePoint(value.southwest ?? value.low);
  return northeast && southwest
    ? {
        north: northeast.lat,
        south: southwest.lat,
        east: northeast.lng,
        west: southwest.lng,
      }
    : undefined;
}

export function parsePath(value: unknown) {
  if (typeof value === 'string') {
    return decodeGooglePolyline(value);
  }
  if (isRecord(value)) {
    const encoded = readOptionalString(value, [
      'encodedPolyline',
      'encoded_polyline',
      'points',
    ]);
    if (encoded) {
      return decodeGooglePolyline(encoded);
    }
    return parsePath(
      value.coordinates ??
        value.path ??
        value.geoJsonLinestring ??
        value.geo_json_linestring,
    );
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((point) => {
    const parsed = parsePoint(point);
    return parsed ? [parsed] : [];
  });
}

export function parsePoint(value: unknown) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = value[0];
    const second = value[1];
    if (
      typeof first === 'number' &&
      Number.isFinite(first) &&
      typeof second === 'number' &&
      Number.isFinite(second)
    ) {
      return Math.abs(first) > 90 && Math.abs(second) <= 90
        ? { lat: second, lng: first }
        : { lat: first, lng: second };
    }
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const lat = readOptionalNumber(value, ['lat', 'latitude']);
  const lng = readOptionalNumber(value, ['lng', 'longitude']);
  return lat === undefined || lng === undefined ? undefined : { lat, lng };
}

export function decodeGooglePolyline(value: string) {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < value.length) {
    const latitudeDelta = decodePolylineValue(value, index);
    if (!latitudeDelta) {
      break;
    }
    index = latitudeDelta.nextIndex;
    const longitudeDelta = decodePolylineValue(value, index);
    if (!longitudeDelta) {
      break;
    }
    index = longitudeDelta.nextIndex;
    latitude += latitudeDelta.value;
    longitude += longitudeDelta.value;
    points.push({ lat: latitude / 1e5, lng: longitude / 1e5 });
  }
  return points;
}

export function decodePolylineValue(
  encoded: string,
  startIndex: number,
): { value: number; nextIndex: number } | null {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte = 0;
  do {
    if (index >= encoded.length) {
      return null;
    }
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && shift < 32);
  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}
