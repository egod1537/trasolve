import { Classes, HTMLSelect, Switch } from '@blueprintjs/core';
import {
  TROUTE_MAX_DEBUG_JOB_DURATION_MS,
  type TrouteTravelMode,
} from '@trasolve/shared';
import { VISIT_TIME_GRANULARITY_MINUTES } from '@/entities/place';
import type { JobBuilderState } from '@/features/troute-testbed/job-builder/jobBuilderModel';

interface JobBuilderSettingsProps {
  state: JobBuilderState;
  startTimeError?: string;
  minJobDurationMsError?: string;
  onChange: (
    patch: Partial<Pick<JobBuilderState, 'startTime' | 'travelMode' | 'debug'>>,
  ) => void;
}

const TRAVEL_MODE_OPTIONS: readonly {
  value: TrouteTravelMode;
  label: string;
}[] = [
  { value: 'TRANSIT', label: '대중교통' },
  { value: 'DRIVING', label: '자동차' },
  { value: 'WALKING', label: '도보' },
  { value: 'BICYCLING', label: '자전거' },
];

export function JobBuilderSettings({
  state,
  startTimeError,
  minJobDurationMsError,
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
      <div className="job-builder-settings-fields">
        <label className="job-builder-settings-row">
          <span>이동수단</span>
          <HTMLSelect
            aria-label="이동수단"
            value={state.travelMode}
            onChange={(event) =>
              onChange({
                travelMode: event.currentTarget.value as TrouteTravelMode,
              })
            }
          >
            {TRAVEL_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </HTMLSelect>
          <small>
            실제 경로 조회에 사용할 이동수단입니다.
            {state.travelTimeSource === 'direct'
              ? ' 직접 Matrix 입력 시 실제 경로 조회는 생략됩니다.'
              : ''}
          </small>
        </label>

        <label className="job-builder-settings-row">
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

        <div className="job-builder-settings-row">
          <span>디버그 모드</span>
          <Switch
            checked={state.debug.enabled}
            label="사용"
            onChange={(event) =>
              onChange({
                debug: {
                  ...state.debug,
                  enabled: event.currentTarget.checked,
                },
              })
            }
          />
        </div>

        <label className="job-builder-settings-row">
          <span>최소 실행 시간</span>
          <span className="job-builder-duration-input">
            <input
              className="bp6-input"
              type="number"
              min={0}
              max={TROUTE_MAX_DEBUG_JOB_DURATION_MS}
              step={100}
              disabled={!state.debug.enabled}
              aria-invalid={Boolean(minJobDurationMsError)}
              value={
                Number.isFinite(state.debug.minJobDurationMs)
                  ? state.debug.minJobDurationMs
                  : ''
              }
              onChange={(event) =>
                onChange({
                  debug: {
                    ...state.debug,
                    minJobDurationMs:
                      event.target.value === ''
                        ? Number.NaN
                        : event.target.valueAsNumber,
                  },
                })
              }
            />
            <span>ms</span>
          </span>
          {minJobDurationMsError ? (
            <small className="job-builder-field-error" role="alert">
              {minJobDurationMsError}
            </small>
          ) : null}
        </label>

        <div className="job-builder-settings-row">
          <span>경로 결과 섞기</span>
          <Switch
            checked={state.debug.shuffleResultRoute}
            disabled={!state.debug.enabled}
            label="사용"
            onChange={(event) =>
              onChange({
                debug: {
                  ...state.debug,
                  shuffleResultRoute: event.currentTarget.checked,
                },
              })
            }
          />
        </div>

        <p className="job-builder-debug-help">
          Testbed 전용 옵션입니다. Job을 최소 지정 시간 동안 실행하여 progress와
          SSE 표시를 테스트합니다. 경로 결과 섞기는 출발지와 도착지는 유지하고
          중간 경유지 결과 순서를 임의로 섞습니다.
        </p>
      </div>
    </section>
  );
}
