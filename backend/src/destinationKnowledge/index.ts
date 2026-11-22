import { z } from 'zod';
import rawSnapshot from './destinations.json' with { type: 'json' };
import {
  destinationCountryCodeSchema,
  destinationDatasetVersion,
  normalizeDestinationIdentity,
  snapshotSchema,
  type DestinationKnowledge,
} from './snapshot.js';

export type { DestinationKnowledge } from './snapshot.js';

const searchSchema = z.strictObject({
  query: z.string().trim().min(1).max(200).optional(),
  countryCode: destinationCountryCodeSchema.optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export type DestinationKnowledgeQuery = z.input<typeof searchSchema>;

export type DestinationKnowledgeLookupResult = Readonly<{
  datasetVersion: string;
  item: DestinationKnowledge | null;
}>;

export type DestinationKnowledgeResult = Readonly<{
  datasetVersion: string;
  items: readonly DestinationKnowledge[];
}>;

const snapshot = snapshotSchema.parse(rawSnapshot);
const datasetVersion = destinationDatasetVersion(snapshot);
const destinationsById = new Map(
  snapshot.destinations.map((destination) => [destination.id, destination]),
);
const searchIndex = snapshot.destinations.map((destination) => {
  const names = [
    normalizeSearchText(destination.name),
    normalizeSearchText(destination.alternateName ?? ''),
  ];
  return {
    destination,
    names,
    searchText: normalizeSearchText(
      [
        ...names,
        destination.region,
        destination.locality,
        destination.category,
        ...destination.highlights,
        ...destination.audiences,
        ...destination.tags,
      ].join(' '),
    ),
  };
});

export function getDestinationKnowledge(
  id: string,
): DestinationKnowledgeLookupResult {
  return { datasetVersion, item: destinationsById.get(id) ?? null };
}

export function searchDestinationKnowledge(
  input: DestinationKnowledgeQuery,
): DestinationKnowledgeResult {
  const { query, countryCode, limit } = searchSchema.parse(input);
  const normalizedQuery = normalizeSearchText(query ?? '');
  if (query && !normalizedQuery) {
    return { datasetVersion, items: [] };
  }

  const terms = normalizedQuery ? [...new Set(normalizedQuery.split(' '))] : [];
  const matches = searchIndex.flatMap(({ destination, names, searchText }) => {
    if (countryCode && destination.countryCode !== countryCode) {
      return [];
    }
    if (!terms.every((term) => searchText.includes(term))) {
      return [];
    }

    // Exact label matches outrank substring matches within the label.
    const exact =
      normalizedQuery !== '' && names.some((name) => name === normalizedQuery);
    const labelMatches = terms.filter((term) =>
      names.some((name) => name.includes(term)),
    ).length;
    return [{ destination, exact, labelMatches }];
  });
  matches.sort(
    (left, right) =>
      Number(right.exact) - Number(left.exact) ||
      right.labelMatches - left.labelMatches,
  );

  return {
    datasetVersion,
    items: matches.slice(0, limit).map(({ destination }) => destination),
  };
}

function normalizeSearchText(value: string): string {
  return normalizeDestinationIdentity(value)
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}
