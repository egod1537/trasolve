import { Component, useEffect, useState } from 'react';
import {
  Alignment,
  Button,
  ButtonGroup,
  Callout,
  Card,
  Classes,
  Divider,
  Intent,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  Tag,
  TextArea,
} from '@blueprintjs/core';
import {
  API_ROUTES,
  isTrouteJobTerminalStatus,
  trouteOptimizeRequestSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { checkApiHealth } from '../../api/health';
import {
  getTrouteJob,
  optimizeRouteWithTroute,
  TrouteNetworkError,
  type TrouteGatewayResult,
} from '../../api/troute';
import '@blueprintjs/core/lib/css/blueprint.css';
import './styles/troute-test.css';

type HealthState = 'checking' | 'online' | 'offline';

type ValidationState = {
  valid: boolean;
  message: string;
};

type InspectionTarget = {
  jobId: string;
};

function createSampleRequestText(): string {
  const sampleRequest: TrouteOptimizeRequest = {
    job_id: `route-testbed-${crypto.randomUUID()}`,
    locations: [
      {
        id: 'start',
        place_id: 'SAMPLE_PLACE_ID_1',
        open_time: '09:00',
        close_time: '18:00',
        stay_minutes: 60,
      },
      {
        id: 'place-2',
        place_id: 'SAMPLE_PLACE_ID_2',
        open_time: '10:00',
        close_time: '19:00',
        stay_minutes: 90,
      },
    ],
    start_location_id: 'start',
    start_time: '09:00',
  };
  return JSON.stringify(sampleRequest, null, 2);
}

function TrouteTestContent() {
  const [input, setInput] = useState(createSampleRequestText);
  const [health, setHealth] = useState<HealthState>('checking');
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<TrouteGatewayResult | null>(null);
  const [networkDurationMs, setNetworkDurationMs] = useState<number | null>(
    null,
  );
  const [inspectionTarget, setInspectionTarget] =
    useState<InspectionTarget | null>(null);
  const [job, setJob] = useState<TrouteJobState | null>(null);
  const [jobInspectionError, setJobInspectionError] = useState('');
  const [copied, setCopied] = useState(false);

  async function refreshHealth(): Promise<void> {
    setHealth('checking');
    setHealth(await getHealthState());
  }

  useEffect(() => {
    const controller = new AbortController();
    void getHealthState(controller.signal).then((nextHealth) => {
      if (!controller.signal.aborted) {
        setHealth(nextHealth);
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!inspectionTarget) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const nextJob = await getTrouteJob(
          inspectionTarget.jobId,
          controller.signal,
        );
        setJob(nextJob);
        setJobInspectionError('');
        if (isTrouteJobTerminalStatus(nextJob.status)) {
          return;
        }
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }
        setJobInspectionError(
          cause instanceof Error
            ? cause.message
            : 'troute job 상태를 조회할 수 없습니다.',
        );
        return;
      }
      timer = setTimeout(() => void poll(), 1_000);
    };

    timer = setTimeout(() => void poll(), 1_000);
    return () => {
      controller.abort();
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    };
  }, [inspectionTarget]);

  function validate(): TrouteOptimizeRequest | null {
    let json: unknown;
    try {
      json = JSON.parse(input) as unknown;
    } catch (cause) {
      setValidation({
        valid: false,
        message: `JSON parsing failed: ${cause instanceof Error ? cause.message : 'Check that the editor contains valid JSON.'}`,
      });
      return null;
    }

    const parsed = trouteOptimizeRequestSchema.safeParse(json);
    if (!parsed.success) {
      setValidation({
        valid: false,
        message: `Request validation failed: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      });
      return null;
    }

    setValidation({ valid: true, message: 'Valid' });
    return parsed.data;
  }

  async function run(): Promise<void> {
    if (busy) {
      return;
    }

    const request = validate();
    if (!request) {
      return;
    }

    setBusy(true);
    setError('');
    setResponse(null);
    setNetworkDurationMs(null);
    setJob(null);
    setJobInspectionError('');
    setCopied(false);
    setInspectionTarget({ jobId: request.job_id });

    try {
      const result = await optimizeRouteWithTroute(request);
      setHealth('online');
      setResponse(result);
      try {
        const reconciledJob = await getTrouteJob(request.job_id);
        setJob(reconciledJob);
        setJobInspectionError('');
      } catch {
        // The polling request reports inspection failures in the response card.
      }

      if (result.httpStatus >= 400) {
        setError(describeHttpError(result));
      } else if (!result.optimization) {
        setError(
          `Response validation failed: ${result.responseValidationError ?? 'The success response does not match the troute contract.'}`,
        );
      }
    } catch (cause) {
      if (cause instanceof TrouteNetworkError) {
        setNetworkDurationMs(cause.durationMs);
      }
      setHealth('offline');
      setError(
        cause instanceof Error
          ? cause.message
          : 'Trasolve backend 요청 중 알 수 없는 오류가 발생했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }

  const finalOptimization = job?.result ?? response?.optimization;
  const visibleError =
    error || (job?.error ? describeJobError(job) : '') || jobInspectionError;
  const raw = response ? formatRawResponse(response) : '';
  const healthLabel =
    health === 'online'
      ? 'Online'
      : health === 'offline'
        ? 'Offline'
        : 'Checking';

  return (
    <div className="app-shell troute-testbed-shell">
      <Navbar className="app-navbar">
        <NavbarGroup align={Alignment.START}>
          <Button
            aria-label="Back to testbed index"
            title="Back to testbed index"
            icon="arrow-left"
            variant="minimal"
            onClick={() => window.location.assign('/testbed')}
          />
          <NavbarHeading>trasolve testbed</NavbarHeading>
          <NavbarDivider />
          <code className={`${Classes.MONOSPACE_TEXT} navbar-endpoint`}>
            /api · POST {API_ROUTES.trouteOptimize}
          </code>
        </NavbarGroup>
        <NavbarGroup align={Alignment.END}>
          <span className={Classes.TEXT_MUTED}>API</span>
          <Tag
            aria-label={`API ${healthLabel}`}
            icon={
              health === 'online'
                ? 'tick-circle'
                : health === 'offline'
                  ? 'error'
                  : 'time'
            }
            intent={healthIntent(health)}
            minimal
          >
            {healthLabel}
          </Tag>
          <Button
            aria-label="Refresh API health"
            title="Refresh API health"
            icon="refresh"
            loading={health === 'checking'}
            disabled={busy || health === 'checking'}
            variant="minimal"
            onClick={() => void refreshHealth()}
          />
        </NavbarGroup>
      </Navbar>

      <main className="playground">
        <Card className="workspace-card request-card" elevation={1} compact>
          <div className="card-heading">
            <h1 className={Classes.HEADING}>Request</h1>
            <ButtonGroup size="small" variant="minimal">
              <Button
                icon="code"
                disabled={busy}
                onClick={() => {
                  const parsed = validate();
                  if (parsed) {
                    setInput(JSON.stringify(parsed, null, 2));
                  }
                }}
              >
                Format
              </Button>
              <Button
                icon="reset"
                disabled={busy}
                onClick={() => {
                  setInput(createSampleRequestText());
                  setValidation(null);
                }}
              >
                Reset sample
              </Button>
            </ButtonGroup>
          </div>
          <Divider />

          <div className="request-content">
            <TextArea
              aria-label="Request JSON"
              className="json-editor"
              fill
              intent={
                validation && !validation.valid ? Intent.DANGER : Intent.NONE
              }
              spellCheck={false}
              autoCapitalize="off"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setValidation(null);
              }}
            />

            {validation && !validation.valid ? (
              <Callout
                compact
                intent={Intent.DANGER}
                role="alert"
                title="Invalid request"
              >
                {validation.message}
              </Callout>
            ) : null}

            <div className="request-actions">
              <div aria-live="polite">
                {validation?.valid ? (
                  <Tag icon="tick" intent={Intent.SUCCESS} minimal>
                    Valid
                  </Tag>
                ) : null}
              </div>
              <ButtonGroup>
                <Button icon="tick" disabled={busy} onClick={validate}>
                  Validate
                </Button>
                <Button
                  icon="play"
                  intent={Intent.PRIMARY}
                  loading={busy}
                  disabled={busy}
                  onClick={() => void run()}
                >
                  Run
                </Button>
              </ButtonGroup>
            </div>
          </div>
        </Card>

        <Card className="workspace-card response-card" elevation={1} compact>
          <div className="card-heading">
            <h1 className={Classes.HEADING}>Response</h1>
            <div className="response-metadata" aria-live="polite">
              {response ? (
                <>
                  <Tag intent={statusIntent(response.httpStatus)}>
                    HTTP {response.httpStatus}
                  </Tag>
                  <Tag icon="stopwatch" minimal>
                    {response.durationMs.toFixed(1)} ms
                  </Tag>
                </>
              ) : networkDurationMs !== null ? (
                <>
                  <Tag intent={Intent.DANGER}>Network error</Tag>
                  <Tag icon="stopwatch" minimal>
                    {networkDurationMs.toFixed(1)} ms
                  </Tag>
                </>
              ) : (
                <span className={Classes.TEXT_MUTED}>No response yet</span>
              )}
            </div>
          </div>
          <Divider />

          <div className="response-content">
            {job || inspectionTarget ? (
              <JobStatus job={job} jobId={inspectionTarget?.jobId ?? null} />
            ) : null}

            {visibleError ? (
              <Callout
                compact
                intent={Intent.DANGER}
                role="alert"
                title="Request failed"
              >
                {visibleError}
              </Callout>
            ) : null}

            {finalOptimization ? (
              <>
                <RouteSummary optimization={finalOptimization} />
                <Divider />
              </>
            ) : null}

            <section className="raw-response" aria-labelledby="raw-title">
              <div className="raw-heading">
                <h2 id="raw-title" className={Classes.HEADING}>
                  Raw response
                </h2>
                <Button
                  icon={copied ? 'tick' : 'clipboard'}
                  intent={copied ? Intent.SUCCESS : Intent.NONE}
                  variant="minimal"
                  size="small"
                  disabled={!response}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(raw);
                      setCopied(true);
                    } catch {
                      setError(
                        'Copy failed. Select and copy the response manually.',
                      );
                    }
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <pre
                className={`${Classes.CODE_BLOCK} raw-output`}
                aria-label="Raw API response"
                aria-busy={busy}
              >
                {response
                  ? raw || '(empty body)'
                  : busy
                    ? 'Waiting for the API…'
                    : 'No response yet.'}
              </pre>
            </section>

            {job ? (
              <details className="job-state-details">
                <summary>Raw job state</summary>
                <pre className={Classes.CODE_BLOCK}>
                  {JSON.stringify(job, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        </Card>
      </main>
    </div>
  );
}

function JobStatus({
  job,
  jobId,
}: {
  job: TrouteJobState | null;
  jobId: string | null;
}) {
  return (
    <section className="job-status" aria-label="Troute job status">
      <code className={Classes.MONOSPACE_TEXT}>{jobId}</code>
      <div>
        <Tag intent={jobStatusIntent(job?.status)} minimal>
          {job?.status ?? 'pending'}
        </Tag>
        {job?.stage ? <Tag minimal>{job.stage}</Tag> : null}
        <Tag minimal>{job?.progress ?? 0}%</Tag>
      </div>
    </section>
  );
}

function RouteSummary({
  optimization,
}: {
  optimization: TrouteOptimizeResponse;
}) {
  return (
    <section className="route-summary" aria-labelledby="route-title">
      <div className="route-overview">
        <div>
          <h2 id="route-title" className={Classes.HEADING}>
            Route
          </h2>
          <div aria-label="Visit order">
            {optimization.route.map((stop) => stop.location_id).join(' → ')}
          </div>
        </div>
        <div>
          <span className={Classes.TEXT_MUTED}>Total travel</span>
          <strong>{optimization.total_travel_minutes} min</strong>
        </div>
      </div>
      <div className="table-scroll">
        <table
          className={`${Classes.HTML_TABLE} ${Classes.HTML_TABLE_BORDERED} ${Classes.HTML_TABLE_STRIPED}`}
        >
          <thead>
            <tr>
              <th>Order</th>
              <th>Location</th>
              <th>Arrival</th>
              <th>Departure</th>
            </tr>
          </thead>
          <tbody>
            {optimization.route.map((stop, index) => (
              <tr key={`${stop.order}-${stop.location_id}-${index}`}>
                <td>{stop.order}</td>
                <td>{stop.location_id}</td>
                <td>{stop.arrival_time}</td>
                <td>{stop.departure_time ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function healthIntent(health: HealthState): Intent {
  if (health === 'online') {
    return Intent.SUCCESS;
  }
  if (health === 'offline') {
    return Intent.DANGER;
  }
  return Intent.PRIMARY;
}

async function getHealthState(signal?: AbortSignal): Promise<HealthState> {
  try {
    const timeout = AbortSignal.timeout(5_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return (await checkApiHealth(requestSignal)) ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

function statusIntent(status: number): Intent {
  if (status >= 500) {
    return Intent.DANGER;
  }
  if (status >= 400) {
    return Intent.WARNING;
  }
  if (status >= 200 && status < 300) {
    return Intent.SUCCESS;
  }
  return Intent.NONE;
}

function jobStatusIntent(status: TrouteJobState['status'] | undefined): Intent {
  if (status === 'completed') {
    return Intent.SUCCESS;
  }
  if (status === 'failed') {
    return Intent.DANGER;
  }
  return Intent.PRIMARY;
}

function formatRawResponse(result: TrouteGatewayResult): string {
  if (result.responseBody === null) {
    return result.rawResponse;
  }
  if (typeof result.responseBody === 'string') {
    return result.rawResponse;
  }
  return JSON.stringify(result.responseBody, null, 2);
}

function describeHttpError(result: TrouteGatewayResult): string {
  const body = result.responseBody;
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const detail = body.error;
    if (typeof detail === 'object' && detail !== null) {
      const code = 'code' in detail ? String(detail.code) : null;
      const message = 'message' in detail ? String(detail.message) : null;
      const upstreamStatus =
        'upstreamStatus' in detail ? Number(detail.upstreamStatus) : null;
      return [
        `HTTP ${result.httpStatus}`,
        code,
        message,
        Number.isFinite(upstreamStatus)
          ? `upstream HTTP ${upstreamStatus}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
  }
  return `Trasolve backend가 HTTP ${result.httpStatus} 응답을 반환했습니다.`;
}

function describeJobError(job: TrouteJobState): string {
  if (!job.error) {
    return '';
  }
  return [job.error.code, job.error.message, job.error.detail]
    .filter(Boolean)
    .join(' · ');
}

export default class TrouteTestPage extends Component {
  public render() {
    return <TrouteTestContent />;
  }
}
