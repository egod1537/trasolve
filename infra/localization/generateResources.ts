import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import {
  LOCALIZATION_HEADERS,
  LOCALIZATION_LOCALES,
  type GeneratedNamespaceResources,
  type LocaleResource,
  type LocalizationLocale,
  type LocalizationNamespace,
  type LocalizationRow,
  type RawLocalizationSheet,
  type SheetCell,
} from './types.js';

const KEY_SEGMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const NAMESPACE_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;
const WINDOWS_RESERVED_FILE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

type KeyTreeNode = {
  key?: string;
  children: Map<string, KeyTreeNode>;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cellText(value: SheetCell): string {
  return value === null || value === undefined ? '' : String(value);
}

function normalizedHeader(row: readonly SheetCell[] | undefined): string[] {
  const headers = (row ?? []).map((cell) => cellText(cell).trim());
  while (headers.at(-1) === '') {
    headers.pop();
  }
  return headers;
}

function isLocalizationLookingHeader(headers: readonly string[]): boolean {
  const names = new Set(headers);
  const localeHeaderCount = LOCALIZATION_LOCALES.filter((locale) =>
    names.has(locale),
  ).length;
  return names.has('loc_key') || localeHeaderCount >= 2;
}

function validateLocalizationHeader(
  sheetTitle: string,
  headers: readonly string[],
): Map<string, number> {
  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length) {
    throw new Error(
      `Sheet "${sheetTitle}" has duplicate headers: ${[...new Set(duplicateHeaders)].join(', ')}.`,
    );
  }

  const required = new Set<string>(LOCALIZATION_HEADERS);
  const missing = LOCALIZATION_HEADERS.filter(
    (header) => !headers.includes(header),
  );
  const unexpected = headers.filter(
    (header) => header && !required.has(header),
  );
  if (missing.length || unexpected.length) {
    const details = [
      missing.length ? `missing: ${missing.join(', ')}` : '',
      unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('; ');
    throw new Error(
      `Sheet "${sheetTitle}" has malformed localization headers (${details}). Expected: ${LOCALIZATION_HEADERS.join(' | ')}.`,
    );
  }

  return new Map(headers.map((header, index) => [header, index]));
}

export function isLocalizationSheet(sheet: RawLocalizationSheet): boolean {
  const headers = normalizedHeader(sheet.values[0]);
  if (!headers.some(Boolean) || !isLocalizationLookingHeader(headers)) {
    return false;
  }
  validateLocalizationHeader(sheet.title, headers);
  validateNamespace(sheet.title);
  return true;
}

function validateNamespace(sheetTitle: string): {
  namespace: string;
  fileName: string;
  collisionKey: string;
} {
  const namespace = sheetTitle.normalize('NFC');
  if (
    sheetTitle !== sheetTitle.trim() ||
    namespace.length > 100 ||
    !NAMESPACE_PATTERN.test(namespace) ||
    WINDOWS_RESERVED_FILE_NAME.test(namespace)
  ) {
    throw new Error(
      `Sheet name "${sheetTitle}" is not a safe namespace filename. Use letters, numbers, underscores, or hyphens without surrounding whitespace.`,
    );
  }
  const fileName = `${namespace}.json`;
  return {
    namespace,
    fileName,
    collisionKey: fileName.toLocaleLowerCase('en-US'),
  };
}

function validateKey(sheetTitle: string, key: string, rowNumber: number): void {
  const segments = key.split('.');
  if (
    !key ||
    key !== key.trim() ||
    segments.some((segment) => !KEY_SEGMENT_PATTERN.test(segment))
  ) {
    throw new Error(
      `Sheet "${sheetTitle}" row ${rowNumber} has invalid loc_key "${key}". Use dot-separated identifier segments such as search.placeholder.`,
    );
  }
}

function validateKeyCollisions(
  sheetTitle: string,
  rows: readonly LocalizationRow[],
): void {
  const root: KeyTreeNode = { children: new Map() };
  for (const row of rows) {
    const segments = row.key.split('.');
    let node = root;
    for (let index = 0; index < segments.length; index += 1) {
      if (node.key) {
        throw new Error(
          `Sheet "${sheetTitle}" has nested-key collision between "${node.key}" and "${row.key}".`,
        );
      }
      const segment = segments[index];
      let child = node.children.get(segment);
      if (!child) {
        child = { children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
    }
    if (node.children.size) {
      const descendant = rows.find((candidate) =>
        candidate.key.startsWith(`${row.key}.`),
      );
      throw new Error(
        `Sheet "${sheetTitle}" has nested-key collision between "${row.key}" and "${descendant?.key ?? `${row.key}.*`}".`,
      );
    }
    node.key = row.key;
  }
}

function parseSheetRows(
  sheet: RawLocalizationSheet,
  headerIndexes: ReadonlyMap<string, number>,
): LocalizationRow[] {
  const rows: LocalizationRow[] = [];
  const keys = new Map<string, number>();
  for (let index = 1; index < sheet.values.length; index += 1) {
    const source = sheet.values[index] ?? [];
    if (source.every((cell) => cellText(cell) === '')) {
      continue;
    }
    const rowNumber = index + 1;
    const key = cellText(source[headerIndexes.get('loc_key')!]);
    if (!key) {
      throw new Error(
        `Sheet "${sheet.title}" row ${rowNumber} is populated but loc_key is empty.`,
      );
    }
    validateKey(sheet.title, key, rowNumber);
    const duplicateRow = keys.get(key);
    if (duplicateRow !== undefined) {
      throw new Error(
        `Sheet "${sheet.title}" has duplicate loc_key "${key}" at rows ${duplicateRow} and ${rowNumber}.`,
      );
    }
    keys.set(key, rowNumber);
    rows.push({
      key,
      rowNumber,
      translations: Object.fromEntries(
        LOCALIZATION_LOCALES.map((locale) => [
          locale,
          cellText(source[headerIndexes.get(locale)!]),
        ]),
      ) as Record<LocalizationLocale, string>,
    });
  }
  rows.sort((left, right) => compareText(left.key, right.key));
  validateKeyCollisions(sheet.title, rows);
  return rows;
}

export function parseLocalizationSheets(
  sheets: readonly RawLocalizationSheet[],
): LocalizationNamespace[] {
  const namespaces: LocalizationNamespace[] = [];
  const outputNames = new Map<string, string>();
  for (const sheet of sheets) {
    const headers = normalizedHeader(sheet.values[0]);
    if (!isLocalizationSheet(sheet)) {
      continue;
    }
    const headerIndexes = validateLocalizationHeader(sheet.title, headers);
    const { namespace, fileName, collisionKey } = validateNamespace(
      sheet.title,
    );
    const collidingSheet = outputNames.get(collisionKey);
    if (collidingSheet) {
      throw new Error(
        `Sheets "${collidingSheet}" and "${sheet.title}" resolve to the same output filename "${fileName}".`,
      );
    }
    outputNames.set(collisionKey, sheet.title);
    namespaces.push({
      namespace,
      fileName,
      rows: parseSheetRows(sheet, headerIndexes),
    });
  }
  return namespaces.sort((left, right) =>
    compareText(left.fileName, right.fileName),
  );
}

function setNestedValue(
  resource: LocaleResource,
  key: string,
  value: string,
): void {
  const segments = key.split('.');
  let target = resource;
  for (const segment of segments.slice(0, -1)) {
    const existing = target[segment];
    if (typeof existing === 'string') {
      throw new Error(`Cannot nest localization key below "${segment}".`);
    }
    if (existing) {
      target = existing;
      continue;
    }
    const child: LocaleResource = Object.create(null);
    target[segment] = child;
    target = child;
  }
  target[segments.at(-1)!] = value;
}

function sortResource(resource: LocaleResource): LocaleResource {
  const sorted: LocaleResource = Object.create(null);
  for (const key of Object.keys(resource).sort(compareText)) {
    const value = resource[key];
    sorted[key] = typeof value === 'string' ? value : sortResource(value);
  }
  return sorted;
}

export function generateLocalizationResources(
  sheets: readonly RawLocalizationSheet[],
): GeneratedNamespaceResources[] {
  return parseLocalizationSheets(sheets).map((sheet) => {
    const resources = Object.fromEntries(
      LOCALIZATION_LOCALES.map((locale) => {
        const resource: LocaleResource = Object.create(null);
        for (const row of sheet.rows) {
          setNestedValue(resource, row.key, row.translations[locale]);
        }
        return [locale, sortResource(resource)];
      }),
    ) as Record<LocalizationLocale, LocaleResource>;
    return {
      namespace: sheet.namespace,
      fileName: sheet.fileName,
      resources,
    };
  });
}

function safeResourcePath(directory: string, fileName: string): string {
  const path = resolve(directory, fileName);
  const within = relative(directory, path);
  if (!within || within.startsWith('..') || isAbsolute(within)) {
    throw new Error(`Generated resource path escapes its locale directory.`);
  }
  return path;
}

export async function writeLocalizationResources(
  generated: readonly GeneratedNamespaceResources[],
  outputRoot: string,
): Promise<number> {
  let written = 0;
  for (const locale of LOCALIZATION_LOCALES) {
    const directory = resolve(outputRoot, locale);
    await mkdir(directory, { recursive: true });
    const expectedFiles = new Set(generated.map((item) => item.fileName));
    const existing = await readdir(directory, { withFileTypes: true });
    for (const entry of existing) {
      if (
        entry.isFile() &&
        entry.name.endsWith('.json') &&
        !expectedFiles.has(entry.name)
      ) {
        await unlink(safeResourcePath(directory, entry.name));
      }
    }
    for (const item of generated) {
      const content = `${JSON.stringify(item.resources[locale], null, 2)}\n`;
      await writeFile(
        safeResourcePath(directory, item.fileName),
        content,
        'utf8',
      );
      written += 1;
    }
  }
  return written;
}
