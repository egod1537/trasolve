import { Button, ButtonGroup, Classes, HTMLSelect } from '@blueprintjs/core';
import { useState } from 'react';
import {
  clearTravelTimeMatrix,
  DEFAULT_MATRIX_GENERATOR_SEED,
  DEFAULT_MATRIX_MAX_MINUTES,
  DEFAULT_MATRIX_MIN_MINUTES,
  fillMissingTravelTimeMatrix,
  generateTravelTimeMatrix,
  getTravelTimeMatrixGeneratorError,
  type JobBuilderMatrixGenerationPattern,
  type TravelTimeMatrixGeneratorOptions,
} from '@/features/troute-testbed/job-builder/jobBuilderMatrixGenerator';
import type {
  JobBuilderLocation,
  JobBuilderTravelTimeMatrixCell,
  JobBuilderTravelTimeSource as TravelTimeSource,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { useL, L, NL } from '@/shared/i18n';

interface JobBuilderTravelTimeSourceProps {
  source: TravelTimeSource;
  locations: readonly JobBuilderLocation[];
  matrix: readonly (readonly JobBuilderTravelTimeMatrixCell[])[];
  onSourceChange: (source: TravelTimeSource) => void;
  onMatrixCellChange: (
    rowIndex: number,
    columnIndex: number,
    value: JobBuilderTravelTimeMatrixCell,
  ) => void;
  onMatrixChange: (matrix: JobBuilderTravelTimeMatrixCell[][]) => void;
}

const MATRIX_PATTERN_OPTIONS: readonly {
  value: JobBuilderMatrixGenerationPattern;
  label: string;
}[] = [
  {
    value: 'directed-uniform',
    get label() {
      return L(
        'testbed:jobBuilderTravelTimeSource.mATRIXPATTERNOPTIONS.label.directedUniform',
      );
    },
  },
  {
    value: 'symmetric',
    get label() {
      return L(
        'testbed:jobBuilderTravelTimeSource.mATRIXPATTERNOPTIONS.label.symmetric',
      );
    },
  },
  {
    value: 'near-symmetric',
    get label() {
      return L(
        'testbed:jobBuilderTravelTimeSource.mATRIXPATTERNOPTIONS.label.nearSymmetric',
      );
    },
  },
  {
    value: 'clustered',
    get label() {
      return L(
        'testbed:jobBuilderTravelTimeSource.mATRIXPATTERNOPTIONS.label.clustered',
      );
    },
  },
  {
    value: 'short-with-outliers',
    get label() {
      return L(
        'testbed:jobBuilderTravelTimeSource.mATRIXPATTERNOPTIONS.label.shortMovesLongOutliers',
      );
    },
  },
];

export function JobBuilderTravelTimeSource({
  source,
  locations,
  matrix,
  onSourceChange,
  onMatrixCellChange,
  onMatrixChange,
}: JobBuilderTravelTimeSourceProps) {
  const L = useL();
  return (
    <section
      className="job-builder-travel-time"
      aria-labelledby="job-builder-travel-time-title"
    >
      <div className="job-builder-travel-time-heading">
        <h2 id="job-builder-travel-time-title" className={Classes.HEADING}>
          {L('testbed:jobBuilderTravelTimeSource.title.travelTimeSource')}
        </h2>
        <p>
          {L(
            'testbed:jobBuilderTravelTimeSource.description.searchTravelTimeUsingActualPlace',
          )}
        </p>
      </div>

      <fieldset className="job-builder-travel-time-options">
        <legend className="sr-only">
          {L('testbed:jobBuilderTravelTimeSource.label.travelTimeSource')}
        </legend>
        <label
          className={`job-builder-travel-time-option${source === 'tcache' ? ' is-selected' : ''}`}
        >
          <input
            type="radio"
            name="job-builder-travel-time-source"
            value="tcache"
            checked={source === 'tcache'}
            onChange={() => onSourceChange('tcache')}
          />
          <span>
            <strong>{NL('tcache')}</strong>
            <small>
              {L(
                'testbed:jobBuilderTravelTimeSource.description.checkActualTravelTimeUsingPlace',
              )}
            </small>
          </span>
        </label>
        <label
          className={`job-builder-travel-time-option${source === 'direct' ? ' is-selected' : ''}`}
        >
          <input
            type="radio"
            name="job-builder-travel-time-source"
            value="direct"
            checked={source === 'direct'}
            onChange={() => onSourceChange('direct')}
          />
          <span>
            <strong>
              {L('testbed:jobBuilderTravelTimeSource.text.directMatrix')}
            </strong>
            <small>
              {L(
                'testbed:jobBuilderTravelTimeSource.description.enteredMatrixUsedAsTcacheSearch',
              )}
            </small>
          </span>
        </label>
      </fieldset>

      {source === 'direct' ? (
        <TravelTimeMatrixEditor
          locations={locations}
          matrix={matrix}
          onCellChange={onMatrixCellChange}
          onMatrixChange={onMatrixChange}
        />
      ) : (
        <p className="job-builder-travel-time-note">
          {L(
            'testbed:jobBuilderTravelTimeSource.description.placeIdRequiredAllLocationsRequest',
          )}
        </p>
      )}
    </section>
  );
}

function TravelTimeMatrixEditor({
  locations,
  matrix,
  onCellChange,
  onMatrixChange,
}: {
  locations: readonly JobBuilderLocation[];
  matrix: readonly (readonly JobBuilderTravelTimeMatrixCell[])[];
  onCellChange: (
    rowIndex: number,
    columnIndex: number,
    value: JobBuilderTravelTimeMatrixCell,
  ) => void;
  onMatrixChange: (matrix: JobBuilderTravelTimeMatrixCell[][]) => void;
}) {
  const L = useL();
  const [minimumInput, setMinimumInput] = useState(
    String(DEFAULT_MATRIX_MIN_MINUTES),
  );
  const [maximumInput, setMaximumInput] = useState(
    String(DEFAULT_MATRIX_MAX_MINUTES),
  );
  const [pattern, setPattern] =
    useState<JobBuilderMatrixGenerationPattern>('directed-uniform');
  const [seedInput, setSeedInput] = useState(
    String(DEFAULT_MATRIX_GENERATOR_SEED),
  );

  if (locations.length === 0) {
    return (
      <p className="job-builder-travel-time-note">
        {L(
          'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.description.editMatrixAddLocation',
        )}
      </p>
    );
  }

  const generatorOptions: TravelTimeMatrixGeneratorOptions = {
    size: locations.length,
    minMinutes: parseIntegerInput(minimumInput),
    maxMinutes: parseIntegerInput(maximumInput),
    pattern,
    seed: parseIntegerInput(seedInput),
  };
  const generatorError = getTravelTimeMatrixGeneratorError(generatorOptions);

  return (
    <div className="job-builder-matrix-editor">
      <div className="job-builder-matrix-scroll">
        <table>
          <caption className="sr-only">
            {L(
              'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.text.travelTimeMatrixByLocation',
            )}
          </caption>
          <thead>
            <tr>
              <th aria-hidden="true" />
              {locations.map((location, index) => (
                <th key={location.id} scope="col" title={location.name}>
                  {getMatrixLabel(index)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locations.map((rowLocation, rowIndex) => (
              <tr key={rowLocation.id}>
                <th scope="row" title={rowLocation.name}>
                  {getMatrixLabel(rowIndex)}
                </th>
                {locations.map((columnLocation, columnIndex) => {
                  const diagonal = rowIndex === columnIndex;
                  const value = diagonal
                    ? 0
                    : (matrix[rowIndex]?.[columnIndex] ?? null);
                  const invalid =
                    !diagonal &&
                    (value === null || !Number.isInteger(value) || value < 0);
                  return (
                    <td key={columnLocation.id}>
                      <input
                        className="bp6-input"
                        type="number"
                        min={0}
                        step={1}
                        disabled={diagonal}
                        required={!diagonal}
                        aria-label={L(
                          'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.ariaLabel.travelTimeFrom',
                          { name: rowLocation.name },
                        )}
                        aria-invalid={invalid}
                        value={value ?? ''}
                        onChange={(event) => {
                          const nextValue =
                            event.currentTarget.value === '' ||
                            !Number.isFinite(event.currentTarget.valueAsNumber)
                              ? null
                              : event.currentTarget.valueAsNumber;
                          onCellChange(rowIndex, columnIndex, nextValue);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="job-builder-matrix-generator"
        aria-label={L(
          'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.ariaLabel.matrixRandomGeneration',
        )}
      >
        <ButtonGroup size="small">
          <Button
            icon="automatic-updates"
            disabled={generatorError !== null}
            onClick={() =>
              onMatrixChange(
                fillMissingTravelTimeMatrix(matrix, generatorOptions),
              )
            }
          >
            {L(
              'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.action.randomlyFillEmptyCells',
            )}
          </Button>
          <Button
            icon="refresh"
            disabled={generatorError !== null}
            onClick={() =>
              onMatrixChange(generateTravelTimeMatrix(generatorOptions))
            }
          >
            {L(
              'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.action.fullRegeneration',
            )}
          </Button>
          <Button
            icon="eraser"
            onClick={() =>
              onMatrixChange(clearTravelTimeMatrix(locations.length))
            }
          >
            {L(
              'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.action.empty',
            )}
          </Button>
        </ButtonGroup>
        <div className="job-builder-matrix-generator-settings">
          <label>
            <span>
              {L(
                'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.text.rangeMinutes',
              )}
            </span>
            <span className="job-builder-matrix-range-inputs">
              <input
                className="bp6-input"
                type="number"
                min={0}
                step={1}
                aria-label={L(
                  'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.ariaLabel.randomMatrixMinimumTravelTime',
                )}
                aria-invalid={generatorError !== null}
                value={minimumInput}
                onChange={(event) => setMinimumInput(event.currentTarget.value)}
              />
              <span aria-hidden="true">~</span>
              <input
                className="bp6-input"
                type="number"
                min={0}
                step={1}
                aria-label={L(
                  'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.ariaLabel.randomMatrixMaximumMovementTime',
                )}
                aria-invalid={generatorError !== null}
                value={maximumInput}
                onChange={(event) => setMaximumInput(event.currentTarget.value)}
              />
            </span>
          </label>
          <label>
            <span>
              {L(
                'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.text.pattern',
              )}
            </span>
            <HTMLSelect
              aria-label={L(
                'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.ariaLabel.randomMatrixGenerationPattern',
              )}
              value={pattern}
              onChange={(event) =>
                setPattern(
                  event.currentTarget
                    .value as JobBuilderMatrixGenerationPattern,
                )
              }
            >
              {MATRIX_PATTERN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </HTMLSelect>
          </label>
          <label>
            <span>{L('testbed:jobBuilderTravelTimeSource.label.seed')}</span>
            <input
              className="bp6-input job-builder-matrix-seed-input"
              type="number"
              min={0}
              step={1}
              aria-label={L(
                'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.ariaLabel.randomMatrixSeed',
              )}
              aria-invalid={generatorError !== null}
              value={seedInput}
              onChange={(event) => setSeedInput(event.currentTarget.value)}
            />
          </label>
        </div>
        {generatorError ? (
          <p className="job-builder-matrix-generator-error" role="alert">
            {generatorError}
          </p>
        ) : null}
      </div>
      <p className="job-builder-travel-time-note">
        {L(
          'testbed:jobBuilderTravelTimeSource.travelTimeMatrixEditor.description.itNNDirectedMatrixDiagonal',
        )}
      </p>
    </div>
  );
}

function parseIntegerInput(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

function getMatrixLabel(index: number): string {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}
