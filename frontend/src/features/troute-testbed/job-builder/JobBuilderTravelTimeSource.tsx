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
  { value: 'directed-uniform', label: '방향별 균등 (Directed Uniform)' },
  { value: 'symmetric', label: '대칭 (Symmetric)' },
  { value: 'near-symmetric', label: '근사 대칭 (Near Symmetric)' },
  { value: 'clustered', label: '군집형 (Clustered)' },
  {
    value: 'short-with-outliers',
    label: '짧은 이동 + 긴 이상치',
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
  return (
    <section
      className="job-builder-travel-time"
      aria-labelledby="job-builder-travel-time-title"
    >
      <div className="job-builder-travel-time-heading">
        <h2 id="job-builder-travel-time-title" className={Classes.HEADING}>
          이동시간 Source
        </h2>
        <p>
          이동시간을 실제 Place ID로 조회하거나 solver에 전달할 directed
          matrix를 직접 입력합니다.
        </p>
      </div>

      <fieldset className="job-builder-travel-time-options">
        <legend className="sr-only">이동시간 소스</legend>
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
            <strong>tcache</strong>
            <small>
              Place ID와 이동수단을 사용해 실제 이동시간을 조회합니다.
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
            <strong>Direct Matrix</strong>
            <small>
              입력한 Matrix를 그대로 사용하며 tcache 조회를 생략합니다.
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
          모든 위치에 Place ID가 필요하며 요청에는 travel_time_matrix를 포함하지
          않습니다. troute가 Place ID와 이동수단으로 directed Matrix를
          생성합니다.
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
        Matrix를 편집하려면 위치를 추가하세요.
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
          <caption className="sr-only">위치별 이동시간 Matrix</caption>
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
                        aria-label={`${rowLocation.name}에서 ${columnLocation.name}까지 이동시간`}
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
        aria-label="Matrix 랜덤 생성"
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
            빈 셀 랜덤 채우기
          </Button>
          <Button
            icon="refresh"
            disabled={generatorError !== null}
            onClick={() =>
              onMatrixChange(generateTravelTimeMatrix(generatorOptions))
            }
          >
            전체 재생성
          </Button>
          <Button
            icon="eraser"
            onClick={() =>
              onMatrixChange(clearTravelTimeMatrix(locations.length))
            }
          >
            비우기
          </Button>
        </ButtonGroup>
        <div className="job-builder-matrix-generator-settings">
          <label>
            <span>범위 (분)</span>
            <span className="job-builder-matrix-range-inputs">
              <input
                className="bp6-input"
                type="number"
                min={0}
                step={1}
                aria-label="랜덤 Matrix 최소 이동시간"
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
                aria-label="랜덤 Matrix 최대 이동시간"
                aria-invalid={generatorError !== null}
                value={maximumInput}
                onChange={(event) => setMaximumInput(event.currentTarget.value)}
              />
            </span>
          </label>
          <label>
            <span>패턴</span>
            <HTMLSelect
              aria-label="랜덤 Matrix 생성 패턴"
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
            <span>Seed</span>
            <input
              className="bp6-input job-builder-matrix-seed-input"
              type="number"
              min={0}
              step={1}
              aria-label="랜덤 Matrix Seed"
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
        N × N directed Matrix입니다. 대각선은 0으로 고정되며 A→B와 B→A는 서로
        독립입니다. travel_mode 값은 유지되지만 실제 routing 조회에는 사용되지
        않습니다.
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
