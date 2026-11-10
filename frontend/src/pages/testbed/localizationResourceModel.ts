import { NL, SUPPORTED_LANGUAGES, type Language } from '@/shared/i18n';
import { localizationInstance } from '@/shared/i18n/config';

export type ResourceObject = Record<string, unknown>;

export type LocaleValues = Record<Language, string | undefined>;

export type LocalizationRow = {
  id: string;
  namespace: string;
  key: string;
  values: LocaleValues;
  missingLocales: Language[];
  emptyLocales: Language[];
  hasError: boolean;
};

export type ResourceSnapshot = {
  namespaces: string[];
  rows: LocalizationRow[];
  bundles: Record<Language, Record<string, ResourceObject>>;
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  ko: NL('KO'),
  ja: NL('JA'),
  en: NL('EN'),
  mn: NL('MN'),
};

export const INTERPOLATION_PATTERN =
  /\{\{\s*-?\s*([^,}\s]+)(?:\s*,[^}]*)?\s*\}\}/gu;

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isResourceObject(value: unknown): value is ResourceObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function flattenResource(
  value: unknown,
  prefix = '',
  result = new Map<string, string>(),
): Map<string, string> {
  if (typeof value === 'string') {
    if (prefix) {
      result.set(prefix, value);
    }
    return result;
  }
  if (!isResourceObject(value)) {
    return result;
  }
  for (const key of Object.keys(value).sort(compareText)) {
    flattenResource(value[key], prefix ? `${prefix}.${key}` : key, result);
  }
  return result;
}

export function createResourceSnapshot(): ResourceSnapshot {
  const bundles = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, {}]),
  ) as Record<Language, Record<string, ResourceObject>>;
  const namespaceSet = new Set<string>();

  for (const language of SUPPORTED_LANGUAGES) {
    const languageData = localizationInstance.getDataByLanguage(language);
    if (!isResourceObject(languageData)) {
      continue;
    }
    for (const [namespace, bundle] of Object.entries(languageData)) {
      namespaceSet.add(namespace);
      if (isResourceObject(bundle)) {
        bundles[language][namespace] = bundle;
      }
    }
  }

  const configuredNamespaces = localizationInstance.options.ns;
  if (typeof configuredNamespaces === 'string') {
    namespaceSet.add(configuredNamespaces);
  } else if (Array.isArray(configuredNamespaces)) {
    configuredNamespaces.forEach((namespace) => namespaceSet.add(namespace));
  }

  const namespaces = [...namespaceSet].sort(compareText);
  const rows = namespaces.flatMap((namespace) => {
    const flattened = Object.fromEntries(
      SUPPORTED_LANGUAGES.map((language) => [
        language,
        flattenResource(bundles[language][namespace]),
      ]),
    ) as Record<Language, Map<string, string>>;
    const keySet = new Set<string>();
    SUPPORTED_LANGUAGES.forEach((language) => {
      flattened[language].forEach((_value, key) => keySet.add(key));
    });

    return [...keySet].sort(compareText).map((key): LocalizationRow => {
      const values = Object.fromEntries(
        SUPPORTED_LANGUAGES.map((language) => [
          language,
          flattened[language].get(key),
        ]),
      ) as LocaleValues;
      const missingLocales = SUPPORTED_LANGUAGES.filter(
        (language) => values[language] === undefined,
      );
      const emptyLocales = SUPPORTED_LANGUAGES.filter(
        (language) => values[language] === '',
      );
      return {
        id: `${namespace}:${key}`,
        namespace,
        key,
        values,
        missingLocales,
        emptyLocales,
        hasError: missingLocales.length > 0 || emptyLocales.length > 0,
      };
    });
  });

  return { namespaces, rows, bundles };
}

export function getResolvedValue(
  row: LocalizationRow,
  interpolationValues: Record<string, string> = {},
): string {
  const value = localizationInstance.t(row.key, {
    ns: row.namespace,
    ...interpolationValues,
  });
  return typeof value === 'string' ? value : String(value);
}

export function getInterpolationVariables(
  row: LocalizationRow | undefined,
): string[] {
  if (!row) {
    return [];
  }
  const variables = new Set<string>();
  for (const language of SUPPORTED_LANGUAGES) {
    const value = row.values[language];
    if (!value) {
      continue;
    }
    for (const match of value.matchAll(INTERPOLATION_PATTERN)) {
      if (match[1]) {
        variables.add(match[1]);
      }
    }
  }
  return [...variables].sort(compareText);
}

export function createInterpolationValues(
  row: LocalizationRow | undefined,
): Record<string, string> {
  return Object.fromEntries(
    getInterpolationVariables(row).map((variable) => [variable, '']),
  );
}

export function localeList(locales: readonly Language[]): string {
  return locales.map((language) => LANGUAGE_LABELS[language]).join(', ');
}
