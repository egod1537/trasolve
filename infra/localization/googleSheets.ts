import { google } from 'googleapis';
import { isLocalizationSheet } from './generateResources.js';
import type { RawLocalizationSheet, SheetCell } from './types.js';

const SHEETS_READONLY_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets.readonly';

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

type ReadSpreadsheetOptions = {
  spreadsheetId: string;
  serviceAccountJson: string | undefined;
};

function parseServiceAccountCredentials(
  value: string | undefined,
): ServiceAccountCredentials {
  if (!value?.trim()) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is required. See infra/localization/README.md.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be a JSON object.');
  }
  const credentials = parsed as Record<string, unknown>;
  if (
    typeof credentials.client_email !== 'string' ||
    !credentials.client_email.trim() ||
    typeof credentials.private_key !== 'string' ||
    !credentials.private_key.trim()
  ) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key.',
    );
  }

  return {
    client_email: credentials.client_email,
    private_key: credentials.private_key,
    project_id:
      typeof credentials.project_id === 'string'
        ? credentials.project_id
        : undefined,
  };
}

function quoteSheetTitle(title: string): string {
  return `'${title.replaceAll("'", "''")}'`;
}

function normalizeCell(value: unknown): SheetCell {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  throw new Error(`Google Sheets returned an unsupported cell value.`);
}

export async function readLocalizationSpreadsheet({
  spreadsheetId,
  serviceAccountJson,
}: ReadSpreadsheetOptions): Promise<RawLocalizationSheet[]> {
  const credentials = parseServiceAccountCredentials(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [SHEETS_READONLY_SCOPE],
  });
  const sheetsApi = google.sheets({ version: 'v4', auth });
  const metadata = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(index,sheetType,title))',
  });
  const tabs = (metadata.data.sheets ?? [])
    .map((sheet) => sheet.properties)
    .filter(
      (properties): properties is NonNullable<typeof properties> =>
        properties?.sheetType === 'GRID' &&
        typeof properties.title === 'string',
    )
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0));

  const result: RawLocalizationSheet[] = [];
  for (const tab of tabs) {
    const headerResponse = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `${quoteSheetTitle(tab.title!)}!1:1`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const headerSheet: RawLocalizationSheet = {
      title: tab.title!,
      values: (headerResponse.data.values ?? []).map((row) =>
        row.map(normalizeCell),
      ),
    };
    if (!isLocalizationSheet(headerSheet)) {
      continue;
    }
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: quoteSheetTitle(tab.title!),
      valueRenderOption: 'FORMATTED_VALUE',
    });
    result.push({
      title: tab.title!,
      values: (response.data.values ?? []).map((row) => row.map(normalizeCell)),
    });
  }
  return result;
}
