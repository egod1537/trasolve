import { createHash } from 'node:crypto';
import { z } from 'zod';

export const destinationCountryCodeSchema = z.enum(['JP', 'KR', 'MN']);

const text = z.string().trim().min(1);
const list = z.array(text).readonly();
const destinationIdSchema = z.string().regex(/^(JP|KR|MN):[a-f0-9]{24}$/);

const destinationSchema = z
  .strictObject({
    id: destinationIdSchema,
    countryCode: destinationCountryCodeSchema,
    region: text,
    locality: text,
    name: text,
    alternateName: text.optional(),
    category: text,
    highlights: list,
    audiences: list,
    bestSeason: text.optional(),
    suggestedStay: text.optional(),
    tags: list,
    source: z
      .strictObject({
        kind: text,
        name: text,
        url: z.url({ protocol: /^https?$/ }),
        language: text.optional(),
        collectedOn: z.iso.date(),
      })
      .readonly(),
  })
  .readonly();

export type DestinationKnowledge = z.infer<typeof destinationSchema>;

export const snapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    destinations: z
      .array(destinationSchema)
      .min(1)
      .refine(
        (destinations) =>
          new Set(destinations.map(({ id }) => id)).size ===
          destinations.length,
        'Destination IDs must be unique',
      )
      .readonly(),
  })
  .readonly();

export type DestinationSnapshot = z.infer<typeof snapshotSchema>;

export function normalizeDestinationIdentity(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function destinationDatasetVersion(
  snapshot: DestinationSnapshot,
): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}`;
}
