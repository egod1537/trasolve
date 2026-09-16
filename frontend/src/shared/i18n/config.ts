import { createInstance, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = ['ko', 'ja', 'en'] as const;
export const DEFAULT_LANGUAGE: Language = 'ko';
export const FALLBACK_LANGUAGE: Language = 'en';

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const LANGUAGE_STORAGE_KEY = 'trasolve.language';
const RESOURCE_PATH_PATTERN =
  /^\.\/(?:resources|generated-local)\/(ko|ja|en)\/([^/]+)\.json$/u;

function isLanguage(value: string | undefined): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}

function isResourceObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPersistedLanguage(): Language {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  try {
    const language =
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? undefined;
    return isLanguage(language) ? language : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function persistLanguage(language: Language): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Localization still works when storage is unavailable or blocked.
  }
}

function applyDocumentLanguage(language: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  const normalized = language.toLocaleLowerCase().split('-')[0];
  document.documentElement.lang = isLanguage(normalized)
    ? normalized
    : DEFAULT_LANGUAGE;
}

function collectResources(
  ...moduleGroups: ReadonlyArray<Readonly<Record<string, unknown>>>
): Resource {
  const resources: Resource = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language, {}]),
  );
  for (const modules of moduleGroups) {
    for (const [path, resource] of Object.entries(modules).sort(
      ([left], [right]) => (left < right ? -1 : left > right ? 1 : 0),
    )) {
      const match = RESOURCE_PATH_PATTERN.exec(path);
      if (!match) {
        throw new Error(`Unexpected localization resource path: ${path}`);
      }
      if (!isResourceObject(resource)) {
        throw new Error(`Localization resource must be a JSON object: ${path}`);
      }
      const [, language, namespace] = match;
      resources[language]![namespace] = resource;
    }
  }
  return resources;
}

const productionResourceModules = import.meta.glob('./resources/*/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const localResourceModules = import.meta.env.DEV
  ? (import.meta.glob('./generated-local/*/*.json', {
      eager: true,
      import: 'default',
    }) as Record<string, unknown>)
  : {};

const resources = collectResources(
  productionResourceModules,
  localResourceModules,
);
const namespaces = Array.from(
  new Set(
    SUPPORTED_LANGUAGES.flatMap((language) =>
      Object.keys(resources[language] ?? {}),
    ),
  ),
).sort();

export const localizationInstance = createInstance();

localizationInstance.on('languageChanged', applyDocumentLanguage);
void localizationInstance.use(initReactI18next).init({
  resources,
  ns: namespaces,
  defaultNS: namespaces[0] ?? 'translation',
  lng: readPersistedLanguage(),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  load: 'currentOnly',
  initAsync: false,
  appendNamespaceToMissingKey: true,
  returnEmptyString: false,
  returnNull: false,
  interpolation: {
    escapeValue: false,
  },
});

export function getLanguage(): Language {
  const normalized = (
    localizationInstance.resolvedLanguage ?? localizationInstance.language
  )
    ?.toLocaleLowerCase()
    .split('-')[0];
  return isLanguage(normalized) ? normalized : DEFAULT_LANGUAGE;
}

export async function setLanguage(language: Language): Promise<void> {
  if (!isLanguage(language)) {
    throw new Error(`Unsupported localization language: ${String(language)}`);
  }
  await localizationInstance.changeLanguage(language);
  persistLanguage(language);
}
