import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  generateLocalizationResources,
  writeLocalizationResources,
} from './generateResources.js';
import { readLocalizationSpreadsheet } from './googleSheets.js';
import { LOCALIZATION_SPREADSHEET_ID } from './opts.js';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const localEnvPath = resolve(repositoryRoot, '.env.local');
const LOCAL_OUTPUT_DIRECTORY =
  'frontend/src/shared/i18n/generated-local' as const;
const PRODUCTION_OUTPUT_DIRECTORY =
  'frontend/src/shared/i18n/resources' as const;

function resolveOutputMode(args: readonly string[]): {
  mode: 'local' | 'production';
  outputRoot: string;
} {
  const unknownArgs = args.filter((arg) => arg !== '--production');
  if (unknownArgs.length) {
    throw new Error(
      `Unknown localization sync option: ${unknownArgs.join(', ')}. Use --production to write Git-tracked resources.`,
    );
  }
  const production = args.includes('--production');
  return {
    mode: production ? 'production' : 'local',
    outputRoot: resolve(
      repositoryRoot,
      production ? PRODUCTION_OUTPUT_DIRECTORY : LOCAL_OUTPUT_DIRECTORY,
    ),
  };
}

async function main(): Promise<void> {
  const { mode, outputRoot } = resolveOutputMode(process.argv.slice(2));
  if (existsSync(localEnvPath)) {
    loadEnvFile(localEnvPath);
  }
  const spreadsheetId =
    process.env.LOCALIZATION_SPREADSHEET_ID?.trim() ||
    LOCALIZATION_SPREADSHEET_ID;
  const sheets = await readLocalizationSpreadsheet({
    spreadsheetId,
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  });
  const generated = generateLocalizationResources(sheets);
  if (!generated.length) {
    throw new Error(
      'No localization tabs were found. Check that each localization tab has the documented header row.',
    );
  }
  const fileCount = await writeLocalizationResources(generated, outputRoot);
  console.log(
    `Localization sync complete (${mode}): ${generated.length} namespaces, ${fileCount} JSON files written to ${outputRoot}.`,
  );
}

main().catch((cause: unknown) => {
  console.error(
    `Localization sync failed: ${cause instanceof Error ? cause.message : String(cause)}`,
  );
  process.exitCode = 1;
});
