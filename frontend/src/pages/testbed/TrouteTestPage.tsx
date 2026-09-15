import { Component, useState } from 'react';
import {
  API_ROUTES,
  trouteOptimizeRequestSchema,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { checkApiHealth } from '../../api/health';
import {
  optimizeRouteWithTroute,
  TrouteNetworkError,
  type TrouteGatewayResult,
} from '../../api/troute';
import './styles/testbed.css';
import './styles/troute-test.css';

const sampleRequest: TrouteOptimizeRequest = {
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

const sampleRequestText = JSON.stringify(sampleRequest, null, 2);

type RequestPhase =
  | 'idle'
  | 'invalid_json'
  | 'invalid_request'
  | 'loading'
  | 'success'
  | 'client_error'
  | 'server_error'
  | 'invalid_response'
  | 'network_error';

type HealthState = 'idle' | 'checking' | 'reachable' | 'unreachable';

type CompletedAttempt = {
  result: TrouteGatewayResult | null;
  requestBody: string;
  requestedAt: Date;
  networkDurationMs?: number;
};

function TrouteTestContent() {
  const [editorText, setEditorText] = useState(sampleRequestText);
  const [phase, setPhase] = useState<RequestPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<CompletedAttempt | null>(null);
  const [healthState, setHealthState] = useState<HealthState>('idle');

  const checkBackend = async () => {
    if (healthState === 'checking') {
      return;
    }
    setHealthState('checking');
    try {
      setHealthState(
        (await checkApiHealth(AbortSignal.timeout(5_000)))
          ? 'reachable'
          : 'unreachable',
      );
    } catch {
      setHealthState('unreachable');
    }
  };

  const sendRequest = async () => {
    if (phase === 'loading') {
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(editorText) as unknown;
    } catch (cause) {
      setPhase('invalid_json');
      setError(
        `JSON 파싱 오류: ${cause instanceof Error ? cause.message : '올바른 JSON인지 확인해 주세요.'}`,
      );
      return;
    }

    const parsed = trouteOptimizeRequestSchema.safeParse(json);
    if (!parsed.success) {
      setPhase('invalid_request');
      setError(
        `요청 검증 오류: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
      return;
    }

    const request = json as TrouteOptimizeRequest;
    const requestedAt = new Date();
    setPhase('loading');
    setError(null);

    try {
      const result = await optimizeRouteWithTroute(request);
      setHealthState('reachable');
      setAttempt({ result, requestBody: result.requestBody, requestedAt });
      if (result.httpStatus >= 400) {
        setPhase(result.httpStatus < 500 ? 'client_error' : 'server_error');
        setError(describeHttpError(result));
      } else if (!result.optimization) {
        setPhase('invalid_response');
        setError(
          `응답 검증 오류: ${result.responseValidationError ?? '성공 응답이 troute 계약과 일치하지 않습니다.'}`,
        );
      } else {
        setPhase('success');
      }
    } catch (cause) {
      setHealthState('unreachable');
      const requestBody =
        cause instanceof TrouteNetworkError
          ? cause.requestBody
          : JSON.stringify(request);
      setAttempt({
        result: null,
        requestBody,
        requestedAt,
        ...(cause instanceof TrouteNetworkError
          ? { networkDurationMs: cause.durationMs }
          : {}),
      });
      setPhase('network_error');
      setError(
        cause instanceof Error
          ? cause.message
          : 'Trasolve backend 요청 중 알 수 없는 오류가 발생했습니다.',
      );
    }
  };

  const status = requestStatus(phase);
  const latency = attempt?.result?.durationMs ?? attempt?.networkDurationMs;

  return (
    <main className="testbed-page troute-test-page">
      <header className="testbed-header">
        <a href="/testbed">← 테스트베드 목록</a>
        <h1>troute Integration Test</h1>
        <p>Trasolve Backend → troute integration testbed</p>
      </header>

      <section className="troute-status-panel" aria-labelledby="status-title">
        <div className="troute-section-heading">
          <div>
            <h2 id="status-title">연결 및 요청 상태</h2>
            <code>POST {API_ROUTES.trouteOptimize}</code>
          </div>
          <button
            type="button"
            disabled={healthState === 'checking'}
            onClick={() => void checkBackend()}
          >
            {healthState === 'checking' ? '확인 중…' : 'Backend 상태 확인'}
          </button>
        </div>
        <dl className="troute-status-grid">
          <div>
            <dt>Backend</dt>
            <dd data-state={healthState}>{healthLabel(healthState)}</dd>
          </div>
          <div>
            <dt>요청 상태</dt>
            <dd data-state={phase}>{status}</dd>
          </div>
          <div>
            <dt>최신 HTTP 상태</dt>
            <dd>
              {attempt?.result
                ? `${attempt.result.httpStatus} ${attempt.result.statusText}`.trim()
                : '—'}
            </dd>
          </div>
          <div>
            <dt>브라우저 왕복 latency</dt>
            <dd>{latency === undefined ? '—' : `${latency.toFixed(1)} ms`}</dd>
          </div>
          <div>
            <dt>최신 요청 시각</dt>
            <dd>{attempt ? attempt.requestedAt.toLocaleString() : '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="troute-editor-panel" aria-labelledby="editor-title">
        <div className="troute-section-heading">
          <div>
            <h2 id="editor-title">요청 편집기</h2>
            <p>표시된 JSON을 그대로 파싱해 Trasolve backend로 전송합니다.</p>
          </div>
          <div className="troute-actions">
            <button
              type="button"
              disabled={phase === 'loading'}
              onClick={() => setEditorText(sampleRequestText)}
            >
              샘플 복원
            </button>
            <button
              className="troute-primary-action"
              type="button"
              disabled={phase === 'loading'}
              onClick={() => void sendRequest()}
            >
              {phase === 'loading' ? '요청 중…' : '요청 보내기'}
            </button>
          </div>
        </div>
        <textarea
          aria-label="troute 최적화 요청 JSON"
          spellCheck={false}
          value={editorText}
          onChange={(event) => setEditorText(event.target.value)}
        />
      </section>

      {error ? (
        <section className="troute-error-panel" role="alert">
          <h2>오류</h2>
          <p>{error}</p>
        </section>
      ) : null}

      <OptimizationSummary optimization={attempt?.result?.optimization} />

      <div className="troute-debug-grid">
        <DebugBody
          title="실제 전송 요청"
          empty="아직 전송한 요청이 없습니다."
          value={attempt?.requestBody}
        />
        <DebugBody
          title="Raw 응답"
          empty={
            attempt?.result === null
              ? 'HTTP 응답을 받지 못했습니다.'
              : '아직 받은 응답이 없습니다.'
          }
          value={attempt?.result?.rawResponse}
        />
      </div>
    </main>
  );
}

function OptimizationSummary({
  optimization,
}: {
  optimization: TrouteOptimizeResponse | null | undefined;
}) {
  if (!optimization) {
    return null;
  }

  return (
    <section className="troute-summary-panel" aria-labelledby="summary-title">
      <div className="troute-section-heading">
        <h2 id="summary-title">최적화 응답 요약</h2>
        <dl>
          <div>
            <dt>총 이동 시간</dt>
            <dd>{optimization.total_travel_minutes}분</dd>
          </div>
          <div>
            <dt>경로 길이</dt>
            <dd>{optimization.route.length}</dd>
          </div>
        </dl>
      </div>
      <div className="troute-table-scroll">
        <table>
          <thead>
            <tr>
              <th>order</th>
              <th>location_id</th>
              <th>arrival_time</th>
              <th>departure_time</th>
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

function DebugBody({
  title,
  empty,
  value,
}: {
  title: string;
  empty: string;
  value: string | undefined;
}) {
  return (
    <section className="troute-debug-panel">
      <h2>{title}</h2>
      {value === undefined ? <p>{empty}</p> : <pre>{value || '(빈 본문)'}</pre>}
    </section>
  );
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

function requestStatus(phase: RequestPhase): string {
  const labels: Record<RequestPhase, string> = {
    idle: '대기',
    invalid_json: 'JSON 오류',
    invalid_request: '요청 검증 오류',
    loading: '요청 중',
    success: '성공',
    client_error: 'Backend 4xx',
    server_error: 'Backend 5xx',
    invalid_response: '응답 검증 오류',
    network_error: '네트워크 오류',
  };
  return labels[phase];
}

function healthLabel(state: HealthState): string {
  const labels: Record<HealthState, string> = {
    idle: '확인 전',
    checking: '확인 중',
    reachable: '연결 가능',
    unreachable: '연결 실패',
  };
  return labels[state];
}

export default class TrouteTestPage extends Component {
  public render() {
    return <TrouteTestContent />;
  }
}
