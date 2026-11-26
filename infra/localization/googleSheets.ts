import { google } from 'googleapis';
import { isLocalizationSheet } from './generateResources.js';
import { readLocalizationXlsx } from './xlsx.js';
import type { RawLocalizationSheet, SheetCell } from './types.js';

const SHEETS_READONLY_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets.readonly';
const PUBLIC_EXPORT_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PUBLIC_EXPORT_LIMIT_BYTES = 10 * 1024 * 1024;

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
  value: string,
): ServiceAccountCredentials {
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
  if (!serviceAccountJson?.trim()) {
    return readPublicLocalizationSpreadsheet(spreadsheetId);
  }
  return readAuthenticatedLocalizationSpreadsheet({
    spreadsheetId,
    serviceAccountJson,
  });
}

async function readAuthenticatedLocalizationSpreadsheet({
  spreadsheetId,
  serviceAccountJson,
}: ReadSpreadsheetOptions & { serviceAccountJson: string }): Promise<
  RawLocalizationSheet[]
> {
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

async function readPublicLocalizationSpreadsheet(
  spreadsheetId: string,
): Promise<RawLocalizationSheet[]> {
  const exportUrl = new URL(
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/export`,
  );
  exportUrl.searchParams.set('format', 'xlsx');
  const response = await fetch(exportUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Public spreadsheet export failed with HTTP ${response.status}. Share the configured Sheet with anyone who has the link, or set GOOGLE_SERVICE_ACCOUNT_JSON for a private Sheet.`,
    );
  }
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (contentType !== PUBLIC_EXPORT_CONTENT_TYPE) {
    throw new Error(
      `Public spreadsheet export returned unexpected content type "${contentType ?? 'unknown'}". Check the Sheet sharing settings.`,
    );
  }
  const contentLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(contentLength) &&
    contentLength > PUBLIC_EXPORT_LIMIT_BYTES
  ) {
    throw new Error('Public spreadsheet export exceeds the 10 MiB limit.');
  }
  const contents = await response.arrayBuffer();
  if (contents.byteLength > PUBLIC_EXPORT_LIMIT_BYTES) {
    throw new Error('Public spreadsheet export exceeds the 10 MiB limit.');
  }
  return readLocalizationXlsx(contents);
}
