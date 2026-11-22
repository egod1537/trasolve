import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  destinationDatasetVersion,
  normalizeDestinationIdentity,
  snapshotSchema,
} from './snapshot.js';

const expectedHeaders = [
  '인기도',
  '권역',
  '도시·지역',
  '여행지',
  '현지어·영문명',
  '유형',
  '추천 포인트',
  '추천 여행자',
  '최적 시기',
  '권장 체류',
  '접근·동선',
  '주의·현지 팁',
  '정보 성격',
  '출처명',
  '출처 URL',
  '출처 언어',
  '수집일',
  '태그',
];
const cellRows = z.array(z.array(z.string().trim())).min(2);
const exportSchema = z.strictObject({
  JP: cellRows,
  KR: cellRows,
  MN: cellRows,
});

async function main(): Promise<void> {
  const [sourceFile, outputFile, ...extra] = process.argv.slice(2);
  if (!sourceFile || !outputFile || extra.length) {
    throw new Error(
      'Usage: node --import tsx backend/src/destinationKnowledge/importCli.ts <sheet-export.json> <new-snapshot.json>',
    );
  }

  const exportsByCountry = exportSchema.parse(
    JSON.parse(await readFile(sourceFile, 'utf8')),
  );
  const destinationRows = Object.entries(exportsByCountry).flatMap(
    ([countryCode, [headers, ...rows]]) => {
      if (
        headers.length !== expectedHeaders.length ||
        !expectedHeaders.every((label, index) => label === headers[index])
      ) {
        throw new Error(
          `Unexpected headers in ${countryCode} travel sheet export`,
        );
      }
      const destinations = rows.filter((row) => row.some(Boolean));
      if (!destinations.length) {
        throw new Error(`Missing destination rows for ${countryCode}`);
      }
      return destinations.map((row) => mapDestinationRow(countryCode, row));
    },
  );
  destinationRows.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );

  const snapshot = snapshotSchema.parse({
    schemaVersion: 1,
    destinations: destinationRows,
  });
  await writeFile(outputFile, `${JSON.stringify(snapshot, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(
    `${snapshot.destinations.length} destinations, ${destinationDatasetVersion(snapshot)}`,
  );
}

function mapDestinationRow(countryCode: string, row: string[]) {
  const [
    ,
    region,
    locality,
    name,
    alternateName,
    category,
    highlights,
    audiences,
    bestSeason,
    suggestedStay,
    ,
    ,
    sourceKind,
    sourceName,
    sourceUrl,
    sourceLanguage,
    collectedOn,
    tags,
  ] = row;
  const identity = [region, locality, name].map((value) =>
    normalizeDestinationIdentity(value ?? ''),
  );
  const identityHash = createHash('sha256')
    .update(JSON.stringify(identity))
    .digest('hex')
    .slice(0, 24);

  return {
    id: `${countryCode}:${identityHash}`,
    countryCode,
    region,
    locality,
    name,
    alternateName: alternateName || undefined,
    category,
    highlights: (highlights ?? '')
      .split('\n')
      .map((line) => line.replace(/^\s*•\s*/u, '').trim())
      .filter(Boolean),
    audiences: splitTags(audiences),
    bestSeason: bestSeason || undefined,
    suggestedStay: suggestedStay || undefined,
    tags: splitTags(tags),
    source: {
      kind: sourceKind,
      name: sourceName,
      url: sourceUrl,
      language: sourceLanguage || undefined,
      collectedOn,
    },
  };
}

function splitTags(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(/[,，]/u)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
