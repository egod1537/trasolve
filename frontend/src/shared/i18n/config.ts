import { createInstance, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  preferenceRepository,
  USER_PREFERENCE_KEYS,
} from '@/shared/preferences/preferenceRepository';

export const SUPPORTED_LANGUAGES = ['ko', 'ja', 'en', 'mn'] as const;
export const DEFAULT_LANGUAGE: Language = 'ko';
export const FALLBACK_LANGUAGE: Language = 'en';

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const RESOURCE_PATH_PATTERN =
  /^\.\.?\/(?:resources|generated-local)\/([^/]+)\/([^/]+)\.json$/u;

function isLanguage(value: string | undefined): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}

function isResourceObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeResourceObjects(
  production: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...production };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = merged[key];
    merged[key] =
      isResourceObject(existing) && isResourceObject(value)
        ? mergeResourceObjects(existing, value)
        : value;
  }
  return merged;
}

function readPersistedLanguage(): Language {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  const language =
    preferenceRepository.read(USER_PREFERENCE_KEYS.language) ?? undefined;
  return isLanguage(language) ? language : DEFAULT_LANGUAGE;
}

function persistLanguage(language: Language): void {
  if (typeof window === 'undefined') {
    return;
  }
  preferenceRepository.write(USER_PREFERENCE_KEYS.language, language);
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
      if (!isLanguage(language)) {
        throw new Error(`Unsupported localization resource language: ${path}`);
      }
      const existing = resources[language]![namespace];
      resources[language]![namespace] = mergeResourceObjects(
        isResourceObject(existing) ? existing : {},
        resource,
      );
    }
  }
  return resources;
}

const languageLoaders = {
  ko: () => import('./languages/ko'),
  en: () => import('./languages/en'),
  ja: () => import('./languages/ja'),
  mn: () => import('./languages/mn'),
};
const initialLanguage = readPersistedLanguage();
const resourceLoads = new Map<Language, Promise<Resource>>();
function loadResources(language: Language): Promise<Resource> {
  const existing = resourceLoads.get(language);
  if (existing) {
    return existing;
  }
  const request = languageLoaders[language]().then((modules) =>
    collectResources(modules.production, modules.local),
  );
  resourceLoads.set(language, request);
  void request.catch(() => {
    if (resourceLoads.get(language) === request) {
      resourceLoads.delete(language);
    }
  });
  return request;
}
// Module evaluation waits for translations, including module-level L() callers.
const initialResources = await Promise.all(
  [...new Set([initialLanguage, FALLBACK_LANGUAGE])].map(loadResources),
);
const resources: Resource = {};
for (const group of initialResources) {
  for (const [language, namespaces] of Object.entries(group)) {
    resources[language] = { ...resources[language], ...namespaces };
  }
}
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
  lng: initialLanguage,
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

let languageChangeRevision = 0;
export async function setLanguage(language: Language): Promise<void> {
  if (!isLanguage(language)) {
    throw new Error(`Unsupported localization language: ${String(language)}`);
  }
  const revision = ++languageChangeRevision;
  const loaded = await loadResources(language);
  if (revision !== languageChangeRevision) {
    return;
  }
  for (const [namespace, value] of Object.entries(loaded[language] ?? {})) {
    localizationInstance.addResourceBundle(language, namespace, value);
  }
  await localizationInstance.changeLanguage(language);
  persistLanguage(language);
}
