import { useEffect, useMemo, useState } from 'react';
import {
  LanguageControl,
  NL,
  useL,
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguage,
  type Language,
} from '@/shared/i18n';
import { localizationInstance } from '@/shared/i18n/config';
import { Panel } from '@/shared/ui/Panel';
import { StatusBadge, type StatusTone } from '@/shared/ui/StatusBadge';
import '@/pages/testbed/styles/testbed.css';
import '@/pages/testbed/styles/localization-test.css';

type ResourceObject = Record<string, unknown>;
type LocaleValues = Record<Language, string | undefined>;

type LocalizationRow = {
  id: string;
  namespace: string;
  key: string;
  values: LocaleValues;
  missingLocales: Language[];
  emptyLocales: Language[];
  hasError: boolean;
};

type ResourceSnapshot = {
  namespaces: string[];
  rows: LocalizationRow[];
  bundles: Record<Language, Record<string, ResourceObject>>;
};

const LANGUAGE_LABELS: Record<Language, string> = {
  ko: NL('KO'),
  ja: NL('JA'),
  en: NL('EN'),
  mn: NL('MN'),
};

const INTERPOLATION_PATTERN = /\{\{\s*-?\s*([^,}\s]+)(?:\s*,[^}]*)?\s*\}\}/gu;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isResourceObject(value: unknown): value is ResourceObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function flattenResource(
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

function createResourceSnapshot(): ResourceSnapshot {
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

function getResolvedValue(
  row: LocalizationRow,
  interpolationValues: Record<string, string> = {},
): string {
  const value = localizationInstance.t(row.key, {
    ns: row.namespace,
    ...interpolationValues,
  });
  return typeof value === 'string' ? value : String(value);
}

function getInterpolationVariables(row: LocalizationRow | undefined): string[] {
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

function createInterpolationValues(
  row: LocalizationRow | undefined,
): Record<string, string> {
  return Object.fromEntries(
    getInterpolationVariables(row).map((variable) => [variable, '']),
  );
}

function localeList(locales: readonly Language[]): string {
  return locales.map((language) => LANGUAGE_LABELS[language]).join(', ');
}

function ValueCell({ value }: { value: string | undefined }) {
  const L = useL();
  if (value === undefined) {
    return (
      <span className="localization-value-placeholder">
        {L('testbed:localizationTestPage.value.missing')}
      </span>
    );
  }
  if (value === '') {
    return (
      <span className="localization-value-placeholder">
        {L('testbed:localizationTestPage.value.empty')}
      </span>
    );
  }
  return <span>{value}</span>;
}

function RowStatus({
  row,
  language,
}: {
  row: LocalizationRow;
  language: Language;
}) {
  const L = useL();
  const badges: { label: string; tone: StatusTone }[] = [];
  if (row.missingLocales.length) {
    badges.push({
      label: L('testbed:localizationTestPage.rowStatus.label.missing', {
        localeList: localeList(row.missingLocales),
      }),
      tone: 'danger',
    });
  }
  if (row.emptyLocales.length) {
    badges.push({
      label: L('testbed:localizationTestPage.rowStatus.label.empty', {
        localeList: localeList(row.emptyLocales),
      }),
      tone: 'warning',
    });
  }
  const currentValue = row.values[language];
  const fallbackValue = row.values[FALLBACK_LANGUAGE];
  if (
    language !== FALLBACK_LANGUAGE &&
    (currentValue === undefined || currentValue === '') &&
    fallbackValue !== undefined &&
    fallbackValue !== ''
  ) {
    badges.push({
      label: L('testbed:localizationTestPage.rowStatus.label.fallbackEn', {
        language: LANGUAGE_LABELS[language],
      }),
      tone: 'accent',
    });
  }
  if (!badges.length) {
    badges.push({ label: L('testbed:appHeader.text.normal'), tone: 'success' });
  }

  return (
    <div className="localization-status-list">
      {badges.map((badge) => (
        <StatusBadge key={badge.label} tone={badge.tone}>
          {badge.label}
        </StatusBadge>
      ))}
    </div>
  );
}

export default function LocalizationTestPage() {
  const L = useL();
  const snapshot = useMemo(() => createResourceSnapshot(), []);
  const [language, setCurrentLanguage] = useState<Language>(getLanguage);
  const [namespaceFilter, setNamespaceFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRowId, setSelectedRowId] = useState(
    snapshot.rows[0]?.id ?? '',
  );
  const [interpolationValues, setInterpolationValues] = useState<
    Record<string, string>
  >(() => createInterpolationValues(snapshot.rows[0]));
  const [rawNamespace, setRawNamespace] = useState(
    snapshot.namespaces[0] ?? '',
  );
  const [rawLanguage, setRawLanguage] = useState<Language>(language);

  useEffect(() => {
    const handleLanguageChanged = () => setCurrentLanguage(getLanguage());
    localizationInstance.on('languageChanged', handleLanguageChanged);
    return () => {
      localizationInstance.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRows = useMemo(
    () =>
      snapshot.rows.filter((row) => {
        if (namespaceFilter && row.namespace !== namespaceFilter) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }
        return [row.id, ...SUPPORTED_LANGUAGES.map((item) => row.values[item])]
          .filter((value): value is string => value !== undefined)
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      }),
    [namespaceFilter, normalizedQuery, snapshot.rows],
  );
  const selectedRow = snapshot.rows.find((row) => row.id === selectedRowId);
  const interpolationVariables = useMemo(
    () => getInterpolationVariables(selectedRow),
    [selectedRow],
  );
  const errorCount = snapshot.rows.filter((row) => row.hasError).length;

  const selectNamespace = (namespace: string): void => {
    setNamespaceFilter(namespace);
    if (namespace) {
      setRawNamespace(namespace);
    }
  };

  const selectRow = (row: LocalizationRow): void => {
    setSelectedRowId(row.id);
    setInterpolationValues(createInterpolationValues(row));
  };

  const rawBundle = rawNamespace
    ? snapshot.bundles[rawLanguage][rawNamespace]
    : undefined;

  return (
    <main className="testbed-page localization-test-page">
      <header className="testbed-header">
        <a href="/testbed">
          {L('testbed:aiChatTestPage.aiChatTestContent.text.testbedList')}
        </a>
        <div className="localization-title-row">
          <div>
            <h1>
              {L('testbed:localizationTestPage.title.localizationTestBed')}
            </h1>
            <p>
              {L(
                'testbed:localizationTestPage.description.comparesResourcesLoadedCurrentLocalizationRuntime',
              )}
            </p>
          </div>
          <LanguageControl
            className="localization-language-control"
            showLabel
          />
        </div>
      </header>

      <section
        className="localization-summary"
        aria-label={L('testbed:localizationTestPage.ariaLabel.resourceSummary')}
      >
        <Panel>
          <span>{L('testbed:localizationTestPage.text.totalNumberKeys')}</span>
          <strong>{snapshot.rows.length.toLocaleString()}</strong>
        </Panel>
        <Panel>
          <span>{L('testbed:localizationTestPage.text.numberNamespaces')}</span>
          <strong>{snapshot.namespaces.length.toLocaleString()}</strong>
        </Panel>
        <Panel>
          <span>{L('testbed:localizationTestPage.text.numberErrors')}</span>
          <strong>{errorCount.toLocaleString()}</strong>
        </Panel>
        <Panel>
          <span>{L('testbed:localizationTestPage.text.numberLanguages')}</span>
          <strong>{SUPPORTED_LANGUAGES.length.toLocaleString()}</strong>
        </Panel>
      </section>

      <Panel
        className="localization-toolbar"
        aria-label={L('testbed:localizationTestPage.ariaLabel.resourceFilter')}
      >
        <label>
          {L('testbed:localizationTestPage.label.namespace')}
          <select
            value={namespaceFilter}
            onChange={(event) => selectNamespace(event.target.value)}
          >
            <option value="">
              {L('testbed:localizationTestPage.text.fullNamespace')}
            </option>
            {snapshot.namespaces.map((namespace) => (
              <option key={namespace} value={namespace}>
                {namespace}
              </option>
            ))}
          </select>
        </label>
        <label className="localization-search-control">
          {L(
            'testbed:localizationTestPage.label.localizationKeyTranslationSearch',
          )}
          <input
            type="search"
            value={query}
            placeholder={L(
              'testbed:localizationTestPage.placeholder.searchKeyKoJaEn',
            )}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span role="status">
          {L('testbed:localizationTestPage.text.show', {
            count: filteredRows.length.toLocaleString(),
          })}
        </span>
      </Panel>

      <section
        className="localization-table-section"
        aria-labelledby="localization-table-title"
      >
        <div className="localization-section-heading">
          <h2 id="localization-table-title">
            {L('testbed:localizationTestPage.title.localeComparison')}
          </h2>
          <p>
            {L('testbed:localizationTestPage.description.ifYouSelectKeyYouCan')}
          </p>
        </div>
        <div className="localization-table-scroll" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  {L('testbed:localizationTestPage.table.column.key')}
                </th>
                <th scope="col">{LANGUAGE_LABELS.ko}</th>
                <th scope="col">{LANGUAGE_LABELS.ja}</th>
                <th scope="col">{LANGUAGE_LABELS.en}</th>
                <th scope="col">{LANGUAGE_LABELS.mn}</th>
                <th scope="col">
                  {L('testbed:localizationTestPage.text.resolved', {
                    language: LANGUAGE_LABELS[language],
                  })}
                </th>
                <th scope="col">
                  {L('testbed:localizationTestPage.table.column.status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} data-selected={row.id === selectedRowId}>
                  <th scope="row">
                    <button type="button" onClick={() => selectRow(row)}>
                      <span>{row.namespace}:</span>
                      {row.key}
                    </button>
                  </th>
                  <td>
                    <ValueCell value={row.values.ko} />
                  </td>
                  <td>
                    <ValueCell value={row.values.ja} />
                  </td>
                  <td>
                    <ValueCell value={row.values.en} />
                  </td>
                  <td>
                    <ValueCell value={row.values.mn} />
                  </td>
                  <td>
                    <ValueCell value={getResolvedValue(row)} />
                  </td>
                  <td>
                    <RowStatus row={row} language={language} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredRows.length ? (
            <p className="localization-empty-state" role="status">
              {L(
                'testbed:localizationTestPage.description.thereNoLocalizationKeyThatMatches',
              )}
            </p>
          ) : null}
        </div>
      </section>

      <section className="localization-detail-grid">
        <Panel
          className="localization-preview"
          aria-labelledby="interpolation-title"
        >
          <div className="localization-section-heading">
            <h2 id="interpolation-title">
              {L('testbed:localizationTestPage.title.interpolationPreview')}
            </h2>
            <p>
              {selectedRow?.id ??
                L('testbed:localizationTestPage.description.noKeySelected')}
            </p>
          </div>
          {selectedRow ? (
            <>
              {interpolationVariables.length ? (
                <div className="localization-interpolation-fields">
                  {interpolationVariables.map((variable) => (
                    <label key={variable}>
                      {variable}
                      <input
                        value={interpolationValues[variable] ?? ''}
                        placeholder={L(
                          'testbed:localizationTestPage.placeholder.value',
                          { variable: variable },
                        )}
                        onChange={(event) =>
                          setInterpolationValues((current) => ({
                            ...current,
                            [variable]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <p>
                  {L(
                    'testbed:localizationTestPage.description.thereNoInterpolationVariableThisKey',
                  )}
                </p>
              )}
              <output className="localization-preview-output">
                <span>
                  {L('testbed:localizationTestPage.text.resolved', {
                    language: LANGUAGE_LABELS[language],
                  })}
                </span>
                <strong>
                  {getResolvedValue(selectedRow, interpolationValues)}
                </strong>
              </output>
            </>
          ) : (
            <p>
              {L('testbed:localizationTestPage.description.selectKeyFromTable')}
            </p>
          )}
        </Panel>

        <Panel className="localization-raw" aria-labelledby="raw-json-title">
          <div className="localization-section-heading">
            <h2 id="raw-json-title">
              {L('testbed:localizationTestPage.title.rawNamespaceJson')}
            </h2>
            <div className="localization-raw-controls">
              <label>
                <span className="sr-only">
                  {L('testbed:localizationTestPage.text.rawJsonNamespace')}
                </span>
                <select
                  value={rawNamespace}
                  onChange={(event) => setRawNamespace(event.target.value)}
                >
                  {snapshot.namespaces.map((namespace) => (
                    <option key={namespace} value={namespace}>
                      {namespace}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">
                  {L('testbed:localizationTestPage.text.rawJsonLanguage')}
                </span>
                <select
                  value={rawLanguage}
                  onChange={(event) =>
                    setRawLanguage(event.target.value as Language)
                  }
                >
                  {SUPPORTED_LANGUAGES.map((item) => (
                    <option key={item} value={item}>
                      {LANGUAGE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <pre tabIndex={0}>{JSON.stringify(rawBundle ?? {}, null, 2)}</pre>
        </Panel>
      </section>
    </main>
  );
}
