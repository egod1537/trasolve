import { Classes, HTMLSelect, Switch } from '@blueprintjs/core';
import {
  TROUTE_MAX_DEBUG_JOB_DURATION_MS,
  type TrouteTravelMode,
} from '@trasolve/shared';
import { VISIT_TIME_GRANULARITY_MINUTES } from '@/entities/place';
import type { JobBuilderState } from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { useL, L } from '@/shared/i18n';

interface JobBuilderSettingsProps {
  jobId: string;
  state: JobBuilderState;
  startTimeError?: string;
  minJobDurationMsError?: string;
  onJobIdChange: (jobId: string) => void;
  onChange: (
    patch: Partial<Pick<JobBuilderState, 'startTime' | 'travelMode' | 'debug'>>,
  ) => void;
}

const TRAVEL_MODE_OPTIONS: readonly {
  value: TrouteTravelMode;
  label: string;
}[] = [
  {
    value: 'TRANSIT',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.publicTransportation');
    },
  },
  {
    value: 'DRIVING',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.car');
    },
  },
  {
    value: 'WALKING',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.walk');
    },
  },
  {
    value: 'BICYCLING',
    get label() {
      return L('testbed:tcacheRouteOptions.mODES.label.bicycle');
    },
  },
];

export function JobBuilderSettings({
  jobId,
  state,
  startTimeError,
  minJobDurationMsError,
  onJobIdChange,
  onChange,
}: JobBuilderSettingsProps) {
  const L = useL();
  return (
    <section
      className="job-builder-settings"
      aria-labelledby="job-settings-title"
    >
      <h2 id="job-settings-title" className={Classes.HEADING}>
        {L('testbed:jobBuilderSettings.title.basicInformation')}
      </h2>
      <div className="job-builder-settings-fields">
        <label className="job-builder-settings-row">
          <span>{L('testbed:jobDetail.overview.text.jobId')}</span>
          <input
            className="bp6-input job-builder-job-id-input"
            type="text"
            value={jobId}
            onChange={(event) => onJobIdChange(event.currentTarget.value)}
          />
          <small>
            {L(
              'testbed:jobBuilderSettings.description.uniqueIdThatIdentifiesTrouteJob',
            )}
          </small>
        </label>

        <label className="job-builder-settings-row">
          <span>
            {L('testbed:jobRequestSummary.label.meansTransportation')}
          </span>
          <HTMLSelect
            aria-label={L(
              'testbed:jobRequestSummary.label.meansTransportation',
            )}
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
            {L(
              'testbed:jobBuilderSettings.description.thisTransportationMethodUsedByTcache',
            )}
            {state.travelTimeSource === 'direct'
              ? ` ${L(
                  'testbed:jobBuilderSettings.description.directMatrixValuesPreservedButNot',
                )}`
              : ''}
          </small>
        </label>

        <label className="job-builder-settings-row">
          <span>
            {L('testbed:jobBuilderSettings.text.minimumDepartureTime')}
          </span>
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
          ) : (
            <small>
              {L(
                'testbed:jobBuilderSettings.description.solverSearchesLatestPossibleDepartureTime',
              )}
            </small>
          )}
        </label>

        <h3 className="job-builder-settings-subheading">
          {L('testbed:jobBuilderSettings.title.advancedDebug')}
        </h3>
        <div className="job-builder-settings-row">
          <span>{L('testbed:jobBuilderSettings.text.debugMode')}</span>
          <Switch
            checked={state.debug.enabled}
            label={L('testbed:jobRequestSummary.text.use')}
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
          <span>
            {L('testbed:jobRequestSummary.label.minimumExecutionTime')}
          </span>
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
            <span>{L('testbed:jobRequestSummary.text.ms')}</span>
          </span>
          {minJobDurationMsError ? (
            <small className="job-builder-field-error" role="alert">
              {minJobDurationMsError}
            </small>
          ) : null}
        </label>

        <div className="job-builder-settings-row">
          <span>{L('testbed:jobRequestSummary.label.shufflePathResults')}</span>
          <Switch
            checked={state.debug.shuffleResultRoute}
            disabled={!state.debug.enabled}
            label={L('testbed:jobRequestSummary.text.use')}
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
          {L(
            'testbed:jobBuilderSettings.description.thisTestbedOnlyOptionTestProgress',
          )}
        </p>
      </div>
    </section>
  );
}
