import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  tripPlaceSchema,
  type Trip,
  type TripPlace,
  type TripPolyline,
} from '@trasolve/shared';
import { defineTripCommand } from '../command/TripCommand';

type Point = TripPlace['location'];
export type ParsedTripFile = { places: TripPlace[]; routes: TripPolyline[] };
export type TripFileErrorCode = 'invalidFile' | 'tooLarge' | 'noPlaces';
export class TripFileError extends Error {
  public constructor(public readonly code: TripFileErrorCode) {
    super(code);
  }
}
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 20 * 1024 * 1024;
const MAX_PLACES = 500;
const pendingId = () => `pending-${crypto.randomUUID()}`;
const descendants = (element: Element | Document, name: string) =>
  Array.from(element.getElementsByTagNameNS('*', name));
const childText = (element: Element, name: string) =>
  Array.from(element.children)
    .find((child) => child.localName === name)
    ?.textContent?.trim() ?? '';
const coordinateKey = (point: Point) =>
  `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

function coordinates(text: string): Point[] {
  const result = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => {
      const parts = value.split(',');
      const lng = Number(parts[0]);
      const lat = Number(parts[1]);
      if (
        parts.length < 2 ||
        !parts[0]?.trim() ||
        !parts[1]?.trim() ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      ) {
        throw new TripFileError('invalidFile');
      }
      return { lat, lng };
    });
  if (result.length > 10_000) {
    throw new TripFileError('tooLarge');
  }
  return result;
}

function metadata(element: Element): Record<string, unknown> {
  const data = descendants(element, 'Data').find(
    (item) => item.getAttribute('name') === 'trasolve',
  );
  if (!data) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(
      descendants(data, 'value')[0]?.textContent ?? '{}',
    );
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    throw new TripFileError('invalidFile');
  }
}

function parseKml(text: string, output: ParsedTripFile) {
  if (text.length > MAX_EXPANDED_BYTES) {
    throw new TripFileError('tooLarge');
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    throw new TripFileError('invalidFile');
  }
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (
    document.documentElement.localName !== 'kml' ||
    document.getElementsByTagName('parsererror').length
  ) {
    throw new TripFileError('invalidFile');
  }
  const placemarks = descendants(document, 'Placemark');
  if (placemarks.length > 1500) {
    throw new TripFileError('tooLarge');
  }
  const byCoordinate = new Map<string, TripPlace>();
  const bySourceId = new Map<string, TripPlace>();
  const addPlace = (
    point: Point,
    name: string,
    source: Record<string, unknown> = {},
    memo?: string,
  ) => {
    if (output.places.length >= MAX_PLACES) {
      throw new TripFileError('tooLarge');
    }
    const {
      id: sourceId,
      order: _order,
      location: _location,
      ...details
    } = source;
    const parsed = tripPlaceSchema.safeParse({
      ...details,
      id: pendingId(),
      name: name || coordinateKey(point),
      location: point,
      order: output.places.length + 1,
      ...(memo && !details.memo ? { memo: memo.slice(0, 4000) } : {}),
    });
    if (!parsed.success) {
      throw new TripFileError('invalidFile');
    }
    output.places.push(parsed.data);
    byCoordinate.set(coordinateKey(point), parsed.data);
    if (typeof sourceId === 'string') {
      bySourceId.set(sourceId, parsed.data);
    }
    return parsed.data;
  };
  for (const mark of placemarks) {
    for (const geometry of descendants(mark, 'Point')) {
      const point = coordinates(
        descendants(geometry, 'coordinates')[0]?.textContent ?? '',
      )[0];
      if (point) {
        addPlace(
          point,
          childText(mark, 'name'),
          metadata(mark),
          childText(mark, 'description'),
        );
      }
    }
  }
  for (const mark of placemarks) {
    for (const line of descendants(mark, 'LineString')) {
      const path = coordinates(
        descendants(line, 'coordinates')[0]?.textContent ?? '',
      );
      if (path.length < 2) {
        continue;
      }
      const extra = metadata(mark);
      const findEndpoint = (point: Point, id: unknown) =>
        (typeof id === 'string' ? bySourceId.get(id) : undefined) ??
        byCoordinate.get(coordinateKey(point)) ??
        addPlace(point, childText(mark, 'name'));
      const from = findEndpoint(path[0]!, extra.from);
      const to = findEndpoint(path.at(-1)!, extra.to);
      if (from.id !== to.id) {
        output.routes.push({
          id: pendingId(),
          fromPlaceId: from.id,
          toPlaceId: to.id,
          path,
          mode:
            extra.mode === 'walking' ||
            extra.mode === 'transit' ||
            extra.mode === 'driving'
              ? extra.mode
              : 'straight',
          order: output.routes.length + 1,
        });
      }
    }
  }
}

export async function readTripFile(file: File): Promise<ParsedTripFile> {
  if (file.size > MAX_BYTES) {
    throw new TripFileError('tooLarge');
  }
  const output: ParsedTripFile = { places: [], routes: [] };
  try {
    if (/\.kml$/i.test(file.name)) {
      parseKml(await file.text(), output);
    } else if (/\.kmz$/i.test(file.name)) {
      let total = 0;
      let count = 0;
      const archive = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (entry) => {
          if (!/\.kml$/i.test(entry.name)) {
            return false;
          }
          total += entry.originalSize;
          count++;
          if (total > MAX_EXPANDED_BYTES || count > 50) {
            throw new TripFileError('tooLarge');
          }
          return true;
        },
      });
      for (const name of Object.keys(archive).sort()) {
        parseKml(strFromU8(archive[name]!), output);
      }
    } else {
      throw new TripFileError('invalidFile');
    }
  } catch (cause) {
    if (cause instanceof TripFileError) {
      throw cause;
    }
    throw new TripFileError('invalidFile');
  }
  if (!output.places.length) {
    throw new TripFileError('noPlaces');
  }
  return output;
}

export function createImportTripFileCommand(
  dayId: string,
  input: ParsedTripFile,
) {
  return defineTripCommand((trip) => {
    const day = trip.days.find((day) => day.id === dayId);
    if (!day || !input.places.length) {
      throw new TripFileError('invalidFile');
    }
    if (day.places.length + input.places.length > MAX_PLACES) {
      throw new TripFileError('tooLarge');
    }
    day.places.push(
      ...structuredClone(input.places).map((place, index) => ({
        ...place,
        order: day.places.length + index + 1,
      })),
    );
    day.polylines.push(
      ...structuredClone(input.routes).map((route, index) => ({
        ...route,
        order: day.polylines.length + index + 1,
      })),
    );
    return trip;
  });
}

const KML_NAMESPACE = 'http://www.opengis.net/kml/2.2';
export function createTripKml(trip: Pick<Trip, 'title' | 'days'>): string {
  const document = window.document.implementation.createDocument(
    KML_NAMESPACE,
    'kml',
  );
  const append = (parent: Element, name: string, text?: string) => {
    const node = document.createElementNS(KML_NAMESPACE, name);
    if (text !== undefined) {
      node.textContent = text;
    }
    parent.append(node);
    return node;
  };
  const extra = (parent: Element, value: unknown) => {
    const data = append(append(parent, 'ExtendedData'), 'Data');
    data.setAttribute('name', 'trasolve');
    append(data, 'value', JSON.stringify(value));
  };
  const root = append(document.documentElement, 'Document');
  append(root, 'name', trip.title);
  for (const day of trip.days) {
    const folder = append(root, 'Folder');
    append(folder, 'name', day.title);
    const places = [...day.places].sort((a, b) => a.order - b.order);
    for (const place of places) {
      const mark = append(folder, 'Placemark');
      append(mark, 'name', place.name);
      if (place.memo) {
        append(mark, 'description', place.memo);
      }
      append(
        append(mark, 'Point'),
        'coordinates',
        `${place.location.lng},${place.location.lat},0`,
      );
      extra(mark, place);
    }
    for (const route of [...day.polylines].sort((a, b) => a.order - b.order)) {
      const from = places.find((place) => place.id === route.fromPlaceId);
      const to = places.find((place) => place.id === route.toPlaceId);
      if (!from || !to) {
        continue;
      }
      const mark = append(folder, 'Placemark');
      append(mark, 'name', `${from.name} → ${to.name}`);
      append(
        append(mark, 'LineString'),
        'coordinates',
        (route.path ?? [from.location, to.location])
          .map((point) => `${point.lng},${point.lat},0`)
          .join(' '),
      );
      extra(mark, { from: from.id, to: to.id, mode: route.mode });
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(document)}\n`;
}

export function downloadTripFile(
  trip: Pick<Trip, 'title' | 'days'>,
  format: 'kml' | 'kmz',
) {
  const kml = createTripKml(trip);
  const content =
    format === 'kmz'
      ? new Uint8Array(zipSync({ 'doc.kml': strToU8(kml) })).buffer
      : kml;
  const blob = new Blob([content], {
    type:
      format === 'kmz'
        ? 'application/vnd.google-earth.kmz'
        : 'application/vnd.google-earth.kml+xml',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  const fileName = Array.from(trip.title, (character) =>
    character.charCodeAt(0) < 32 ? '_' : character,
  )
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 120);
  anchor.download = `${fileName}.${format}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
