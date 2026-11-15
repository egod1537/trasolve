import { Classes } from '@blueprintjs/core';

import type {
  JobBuilderLocation,
  JobBuilderTravelTimeMatrixCell,
  JobBuilderTravelTimeSource as TravelTimeSource,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { useL, NL } from '@/shared/i18n';
import { TravelTimeMatrixEditor } from '@/features/troute-testbed/job-builder/TravelTimeMatrixEditor';

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
