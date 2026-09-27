import { Button, Classes, Intent, Tag } from '@blueprintjs/core';
import type {
  TrouteOptimizeRequest,
  TrouteStartPolicy,
  TrouteTravelMode,
} from '@trasolve/shared';
import { memo, useEffect, useMemo, useState } from 'react';
import { JobRequestLocationTable } from '@/features/troute-testbed/components/detail/JobRequestLocationTable';
import { useL, L, NL } from '@/shared/i18n';

interface JobRequestSummaryProps {
  request: TrouteOptimizeRequest;
}

const TRAVEL_MODE_LABELS: Record<TrouteTravelMode, string> = {
  get TRANSIT() {
    return L('testbed:tcacheRouteOptions.mODES.label.publicTransportation');
  },
  get DRIVING() {
    return L('testbed:tcacheRouteOptions.mODES.label.car');
  },
  get WALKING() {
    return L('testbed:tcacheRouteOptions.mODES.label.walk');
  },
  get BICYCLING() {
    return L('testbed:tcacheRouteOptions.mODES.label.bicycle');
  },
};

const START_POLICY_LABELS: Record<TrouteStartPolicy, string> = {
  get FIXED() {
    return L('testbed:jobRequestSummary.sTARTPOLICYLABELS.text.designatedTime');
  },
  get EARLIEST() {
    return L(
      'testbed:jobRequestSummary.sTARTPOLICYLABELS.text.asSoonAsPossible',
    );
  },
  get LATEST() {
    return L(
      'testbed:jobRequestSummary.sTARTPOLICYLABELS.text.asLateAsPossible',
    );
  },
};

export const JobRequestSummary = memo(function JobRequestSummary({
  request,
}: JobRequestSummaryProps) {
  const L = useL();
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const travelMode = request.travel_mode ?? 'TRANSIT';
  const startPolicy = request.start_policy ?? 'LATEST';
  const json = useMemo(() => JSON.stringify(request, null, 2), [request]);
  const debugEnabled = request.debug !== undefined;
  const shuffleEnabled = request.debug?.shuffle_result_route === true;
  const shuffleSeed = readNumericDebugOption(request.debug, 'shuffle_seed');
  const hasDebugOptions =
    request.debug?.min_job_duration_ms !== undefined ||
    request.debug?.shuffle_result_route !== undefined ||
    shuffleSeed !== undefined;

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 1_500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <details
      className="job-request-summary"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        <span className="job-request-summary-title">
          <span className={Classes.HEADING}>
            {L('testbed:jobDetail.requestSection.title.request')}
          </span>
          {debugEnabled ? (
            <Tag intent={Intent.PRIMARY} minimal>
              {NL('DEBUG')}
            </Tag>
          ) : null}
          {shuffleEnabled ? (
            <Tag icon="random" intent={Intent.PRIMARY} minimal>
              {L('testbed:jobRequestSummary.text.shufflePaths')}
            </Tag>
          ) : null}
        </span>
        <span className={Classes.TEXT_MUTED}>
          {expanded
            ? L('testbed:jobRequestSummary.text.fold')
            : L('testbed:jobRequestSummary.text.expand')}
        </span>
      </summary>

      <div className="job-request-summary-content">
        <dl className="job-request-facts">
          <div>
            <dt>{L('testbed:jobDetail.overview.text.jobId')}</dt>
            <dd className={Classes.MONOSPACE_TEXT}>{request.job_id}</dd>
          </div>
          <div>
            <dt>{L('testbed:jobRequestSummary.label.startupMethod')}</dt>
            <dd>
              {START_POLICY_LABELS[startPolicy]} ({startPolicy})
            </dd>
          </div>
          <div>
            <dt>{L('testbed:jobRequestSummary.label.startTime')}</dt>
            <dd>{request.start_time ?? '—'}</dd>
          </div>
          <div>
            <dt>{L('testbed:jobRequestSummary.label.meansTransportation')}</dt>
            <dd>
              {TRAVEL_MODE_LABELS[travelMode]} ({travelMode})
            </dd>
          </div>
          <div>
            <dt>{NL('Debug')}</dt>
            <dd>
              {debugEnabled
                ? L('testbed:jobRequestSummary.text.use')
                : L('testbed:jobRequestSummary.text.disabled')}
            </dd>
          </div>
        </dl>

        {request.debug && hasDebugOptions ? (
          <dl className="job-request-debug-options">
            {request.debug.min_job_duration_ms !== undefined ? (
              <div>
                <dt>
                  {L('testbed:jobRequestSummary.label.minimumExecutionTime')}
                </dt>
                <dd>
                  {L('testbed:jobRequestSummary.text.ms2', {
                    min_job_duration_ms: request.debug.min_job_duration_ms,
                  })}
                </dd>
              </div>
            ) : null}
            {request.debug.shuffle_result_route !== undefined ? (
              <div>
                <dt>
                  {L('testbed:jobRequestSummary.label.shufflePathResults')}
                </dt>
                <dd>
                  {request.debug.shuffle_result_route
                    ? L('testbed:jobRequestSummary.text.use')
                    : L('testbed:jobRequestSummary.text.disabled')}
                </dd>
              </div>
            ) : null}
            {shuffleSeed !== undefined ? (
              <div>
                <dt>{L('testbed:jobRequestSummary.label.shuffleSeed')}</dt>
                <dd>{shuffleSeed}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {shuffleEnabled ? (
          <p className="job-request-shuffle-note">
            {L(
              'testbed:jobRequestSummary.description.jobDebugPathShufflingEnabledKeep',
            )}
          </p>
        ) : null}

        <section
          className="job-request-route"
          aria-labelledby="job-request-route-title"
        >
          <h3 id="job-request-route-title" className={Classes.HEADING}>
            {L('testbed:jobRequestSummary.title.inputPath')}
          </h3>
          <div
            aria-label={L(
              'testbed:jobRequestSummary.ariaLabel.requestLocationInputOrder',
            )}
          >
            {request.locations.map((location) => location.id).join(' → ')}
          </div>
        </section>

        <JobRequestLocationTable locations={request.locations} />

        <details className="job-request-raw-json">
          <summary>{L('testbed:jobRequestSummary.text.rawJsonView')}</summary>
          <div>
            <header>
              <span className={Classes.TEXT_MUTED}>
                {L('testbed:jobRequestSummary.text.savedOriginalRequests')}
              </span>
              <Button
                aria-label={
                  copied
                    ? L('testbed:jobRequestSummary.ariaLabel.requestJsonCopied')
                    : L('testbed:jobRequestSummary.ariaLabel.copyRequestJson')
                }
                icon={copied ? 'tick' : 'clipboard'}
                intent={copied ? Intent.SUCCESS : Intent.NONE}
                size="small"
                variant="minimal"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(json)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied
                  ? L('testbed:jobRequestSummary.action.copied')
                  : L('common:action.copy')}
              </Button>
            </header>
            <pre className={`${Classes.CODE_BLOCK} job-request-json-code`}>
              {json}
            </pre>
          </div>
        </details>
      </div>
    </details>
  );
});

function readNumericDebugOption(
  debug: TrouteOptimizeRequest['debug'],
  key: string,
): number | undefined {
  if (!debug) {
    return undefined;
  }
  const value = Object.entries(debug).find(([name]) => name === key)?.[1];
  return typeof value === 'number' ? value : undefined;
}
