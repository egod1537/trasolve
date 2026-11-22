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

const searchTextSchema = z.string().trim().min(1).max(200).optional();
export const destinationKnowledgeSearchSchema = z.strictObject({
  query: searchTextSchema,
  region: searchTextSchema,
  preference: searchTextSchema,
  countryCode: destinationCountryCodeSchema.optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export type DestinationKnowledgeQuery = z.input<
  typeof destinationKnowledgeSearchSchema
>;

type DatasetMetadata = Readonly<{
  datasetVersion: string;
  snapshotUpdatedAt: string;
}>;

export type DestinationKnowledgeLookupResult = DatasetMetadata &
  Readonly<{
    item: DestinationKnowledge | null;
  }>;

export type DestinationKnowledgeResult = DatasetMetadata &
  Readonly<{
    items: readonly DestinationKnowledge[];
  }>;

const snapshot = snapshotSchema.parse(rawSnapshot);
const datasetMetadata: DatasetMetadata = {
  datasetVersion: destinationDatasetVersion(snapshot),
  snapshotUpdatedAt: snapshot.updatedAt,
};
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
    regionText: normalizeSearchText(
      [destination.region, destination.locality].join(' '),
    ),
    preferenceText: normalizeSearchText(
      [
        destination.category,
        ...destination.audiences,
        ...destination.tags,
      ].join(' '),
    ),
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
  return { ...datasetMetadata, item: destinationsById.get(id) ?? null };
}

export function searchDestinationKnowledge(
  input: DestinationKnowledgeQuery,
): DestinationKnowledgeResult {
  const { query, region, preference, countryCode, limit } =
    destinationKnowledgeSearchSchema.parse(input);
  const normalizedQuery = normalizeSearchText(query ?? '');
  const regionTerms = searchTerms(region);
  const preferenceTerms = searchTerms(preference);
  const terms = searchTerms(query);
  const matches = searchIndex.flatMap(
    ({ destination, names, searchText, regionText, preferenceText }) => {
      const matchesFilters =
        (!countryCode || destination.countryCode === countryCode) &&
        terms.every((term) => searchText.includes(term)) &&
        regionTerms.every((term) => regionText.includes(term)) &&
        preferenceTerms.every((term) => preferenceText.includes(term));
      if (!matchesFilters) {
        return [];
      }

      // Exact label matches outrank substring matches within the label.
      const exact =
        normalizedQuery !== '' &&
        names.some((name) => name === normalizedQuery);
      const labelMatches = terms.filter((term) =>
        names.some((name) => name.includes(term)),
      ).length;
      return [{ destination, exact, labelMatches }];
    },
  );
  matches.sort(
    (left, right) =>
      Number(right.exact) - Number(left.exact) ||
      right.labelMatches - left.labelMatches,
  );

  return {
    ...datasetMetadata,
    items: matches.slice(0, limit).map(({ destination }) => destination),
  };
}

function searchTerms(value: string | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  const normalized = normalizeSearchText(value);
  // A supplied value without searchable characters must not widen the search.
  return normalized ? [...new Set(normalized.split(' '))] : [value];
}

function normalizeSearchText(value: string): string {
  return normalizeDestinationIdentity(value)
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}
