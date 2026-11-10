import { useEffect, useMemo, useState } from 'react';
import {
  LanguageControl,
  useL,
  SUPPORTED_LANGUAGES,
  getLanguage,
  type Language,
} from '@/shared/i18n';
import { localizationInstance } from '@/shared/i18n/config';
import { Panel } from '@/shared/ui/Panel';
import '@/pages/testbed/styles/testbed.css';
import '@/pages/testbed/styles/localization-test.css';
import {
  type LocalizationRow,
  LANGUAGE_LABELS,
  createResourceSnapshot,
  getResolvedValue,
  getInterpolationVariables,
  createInterpolationValues,
} from '@/pages/testbed/localizationResourceModel';
import { ValueCell, RowStatus } from '@/pages/testbed/LocalizationStatus';

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
            className="ui-select"
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
            className="ui-field"
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
                        className="ui-field"
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
                  className="ui-select"
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
                  className="ui-select"
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
