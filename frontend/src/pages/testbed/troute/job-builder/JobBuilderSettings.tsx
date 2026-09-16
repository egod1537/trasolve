import { Classes } from '@blueprintjs/core';
import { VISIT_TIME_GRANULARITY_MINUTES } from '../../../map/domain/timeGranularity';
import type { JobBuilderState } from './jobBuilderModel';

interface JobBuilderSettingsProps {
  state: JobBuilderState;
  startTimeError?: string;
  onChange: (patch: Pick<JobBuilderState, 'startTime'>) => void;
}

export function JobBuilderSettings({
  state,
  startTimeError,
  onChange,
}: JobBuilderSettingsProps) {
  return (
    <section
      className="job-builder-settings"
      aria-labelledby="job-settings-title"
    >
      <h2 id="job-settings-title" className={Classes.HEADING}>
        요청 설정
      </h2>
      <label>
        <span>시작 시각</span>
        <input
          className="bp6-input"
          type="time"
          step={VISIT_TIME_GRANULARITY_MINUTES * 60}
          aria-invalid={Boolean(startTimeError)}
          value={state.startTime}
          onChange={(event) => onChange({ startTime: event.target.value })}
        />
        {startTimeError ? (
          <small className="job-builder-field-error" role="alert">
            {startTimeError}
          </small>
        ) : null}
      </label>
    </section>
  );
}
