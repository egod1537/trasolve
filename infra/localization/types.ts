export const LOCALIZATION_LOCALES = ['ko', 'ja', 'en'] as const;

export const LOCALIZATION_HEADERS = [
  'loc_key',
  ...LOCALIZATION_LOCALES,
  'context',
  'status',
] as const;

export type LocalizationLocale = (typeof LOCALIZATION_LOCALES)[number];

export type SheetCell = string | number | boolean | null | undefined;

export type RawLocalizationSheet = {
  title: string;
  values: readonly (readonly SheetCell[])[];
};

export type LocalizationRow = {
  key: string;
  rowNumber: number;
  translations: Record<LocalizationLocale, string>;
};

export type LocalizationNamespace = {
  namespace: string;
  fileName: string;
  rows: readonly LocalizationRow[];
};

export type LocaleResource = {
  [key: string]: string | LocaleResource;
};

export type GeneratedNamespaceResources = {
  namespace: string;
  fileName: string;
  resources: Record<LocalizationLocale, LocaleResource>;
};
