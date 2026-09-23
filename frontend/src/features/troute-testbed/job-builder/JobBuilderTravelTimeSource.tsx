import { Classes } from '@blueprintjs/core';
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
}

export function JobBuilderTravelTimeSource({
  source,
  locations,
  matrix,
  onSourceChange,
  onMatrixCellChange,
}: JobBuilderTravelTimeSourceProps) {
  return (
    <section
      className="job-builder-travel-time"
      aria-labelledby="job-builder-travel-time-title"
    >
      <div className="job-builder-travel-time-heading">
        <h2 id="job-builder-travel-time-title" className={Classes.HEADING}>
          Travel Time Source
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
            <strong>tcache에서 조회</strong>
            <small>실제 Place ID 기반 이동시간을 사용합니다.</small>
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
            <strong>직접 Matrix 입력</strong>
            <small>
              입력한 이동시간을 그대로 solver에 전달하고 tcache를 생략합니다.
            </small>
          </span>
        </label>
      </fieldset>

      {source === 'direct' ? (
        <TravelTimeMatrixEditor
          locations={locations}
          matrix={matrix}
          onCellChange={onMatrixCellChange}
        />
      ) : (
        <p className="job-builder-travel-time-note">
          모든 위치에 Place ID가 필요하며 요청에는 travel_time_matrix를 포함하지
          않습니다.
        </p>
      )}
    </section>
  );
}

function TravelTimeMatrixEditor({
  locations,
  matrix,
  onCellChange,
}: {
  locations: readonly JobBuilderLocation[];
  matrix: readonly (readonly JobBuilderTravelTimeMatrixCell[])[];
  onCellChange: (
    rowIndex: number,
    columnIndex: number,
    value: JobBuilderTravelTimeMatrixCell,
  ) => void;
}) {
  if (locations.length === 0) {
    return (
      <p className="job-builder-travel-time-note">
        Matrix를 편집하려면 위치를 추가하세요.
      </p>
    );
  }

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
      <p className="job-builder-travel-time-note">
        대각선은 0으로 고정되며, 방향별 이동시간을 각각 입력할 수 있습니다.
      </p>
    </div>
  );
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
