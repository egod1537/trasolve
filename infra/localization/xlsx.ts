import { posix } from 'node:path';
import { unzipSync, type Unzipped } from 'fflate';
import type { RawLocalizationSheet, SheetCell } from './types.js';

const textDecoder = new TextDecoder();

type XmlAttributes = Record<string, string>;

export function readLocalizationXlsx(
  contents: ArrayBuffer,
): RawLocalizationSheet[] {
  const archive = unzipSync(new Uint8Array(contents));
  const workbookXml = readArchiveText(archive, 'xl/workbook.xml');
  const relationships = readRelationships(
    readArchiveText(archive, 'xl/_rels/workbook.xml.rels'),
  );
  const sharedStrings = readSharedStrings(archive);

  return [...workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gu)].map((match) => {
    const attributes = readAttributes(match[1]);
    const title = attributes.name;
    const relationshipId = attributes['r:id'];
    const target = relationshipId
      ? relationships.get(relationshipId)
      : undefined;
    if (!title || !target) {
      throw new Error('XLSX workbook contains an invalid worksheet entry.');
    }
    const worksheetPath = resolveWorksheetPath(target);
    return {
      title,
      values: readWorksheet(
        readArchiveText(archive, worksheetPath),
        sharedStrings,
      ),
    };
  });
}

function readArchiveText(archive: Unzipped, path: string): string {
  const contents = archive[path];
  if (!contents) {
    throw new Error(`XLSX archive is missing "${path}".`);
  }
  return textDecoder.decode(contents);
}

function readRelationships(xml: string): Map<string, string> {
  return new Map(
    [...xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gu)].map((match) => {
      const attributes = readAttributes(match[1]);
      if (!attributes.Id || !attributes.Target) {
        throw new Error('XLSX workbook contains an invalid relationship.');
      }
      return [attributes.Id, attributes.Target];
    }),
  );
}

function readSharedStrings(archive: Unzipped): string[] {
  const contents = archive['xl/sharedStrings.xml'];
  if (!contents) {
    return [];
  }
  const xml = textDecoder.decode(contents);
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gu)].map((match) =>
    readTextNodes(match[1]),
  );
}

function readWorksheet(
  xml: string,
  sharedStrings: readonly string[],
): SheetCell[][] {
  const values: SheetCell[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gu)) {
    const rowAttributes = readAttributes(rowMatch[1]);
    const declaredRow = Number.parseInt(rowAttributes.r ?? '', 10);
    const rowIndex = Number.isFinite(declaredRow)
      ? declaredRow - 1
      : values.length;
    const row: SheetCell[] = [];
    let nextColumn = 0;
    for (const cellMatch of rowMatch[2].matchAll(
      /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu,
    )) {
      const attributes = readAttributes(cellMatch[1]);
      const column = attributes.r ? columnIndex(attributes.r) : nextColumn;
      row[column] = readCellValue(
        attributes.t,
        cellMatch[2] ?? '',
        sharedStrings,
      );
      nextColumn = column + 1;
    }
    trimEmptyEnd(row);
    values[rowIndex] = row;
  }
  while (values.length && !values.at(-1)?.length) {
    values.pop();
  }
  return values;
}

function readCellValue(
  type: string | undefined,
  contents: string,
  sharedStrings: readonly string[],
): SheetCell {
  if (type === 'inlineStr') {
    return readTextNodes(contents);
  }
  const rawValue = /<v\b[^>]*>([\s\S]*?)<\/v>/u.exec(contents)?.[1] ?? '';
  if (type === 's') {
    const index = Number.parseInt(rawValue, 10);
    const value = sharedStrings[index];
    if (value === undefined) {
      throw new Error(
        `XLSX cell references missing shared string ${rawValue}.`,
      );
    }
    return value;
  }
  if (type === 'b') {
    return rawValue === '1';
  }
  return decodeXml(rawValue);
}

function readTextNodes(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)]
    .map((match) => decodeXml(match[1]))
    .join('');
}

function readAttributes(source: string): XmlAttributes {
  return Object.fromEntries(
    [...source.matchAll(/([\w:.-]+)="([^"]*)"/gu)].map((match) => [
      match[1],
      decodeXml(match[2]),
    ]),
  );
}

function decodeXml(value: string): string {
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/giu,
    (entity, decimal: string, hexadecimal: string, named: string) => {
      if (decimal) {
        return String.fromCodePoint(Number.parseInt(decimal, 10));
      }
      if (hexadecimal) {
        return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      }
      return (
        {
          amp: '&',
          apos: "'",
          gt: '>',
          lt: '<',
          quot: '"',
        }[named.toLowerCase()] ?? entity
      );
    },
  );
}

function columnIndex(reference: string): number {
  const letters = /^[A-Z]+/iu.exec(reference)?.[0];
  if (!letters) {
    throw new Error(`XLSX cell has invalid reference "${reference}".`);
  }
  return (
    [...letters.toUpperCase()].reduce(
      (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
      0,
    ) - 1
  );
}

function resolveWorksheetPath(target: string): string {
  const path = target.startsWith('/')
    ? target.slice(1)
    : posix.join('xl', target);
  const normalized = posix.normalize(path);
  if (!normalized.startsWith('xl/')) {
    throw new Error('XLSX worksheet path escapes the workbook directory.');
  }
  return normalized;
}

function trimEmptyEnd(row: SheetCell[]): void {
  while (row.length && (row.at(-1) === '' || row.at(-1) === undefined)) {
    row.pop();
  }
}
