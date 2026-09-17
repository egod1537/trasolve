import { API_ROUTES } from '@trasolve/shared';

const HEALTH_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface TcacheApiResult {
  httpStatus: number;
  body: unknown;
  durationMs: number;
}

export interface TcacheRouteCreateLocation {
  placeId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface TcacheRouteCreateRequest {
  locations: TcacheRouteCreateLocation[];
  mode: string;
  departureTime?: string;
  computeAlternativeRoutes?: boolean;
  languageCode?: string;
  regionCode?: string;
  routingPreference?: string;
  units?: string;
}

export interface TcacheRouteSseEvent {
  type: string;
  id?: string;
  data: string;
  raw: string;
}

export interface TcacheRouteSubscriptionOptions {
  signal: AbortSignal;
  lastEventId?: string;
  onOpen: () => void;
  onEvent: (event: TcacheRouteSseEvent) => void;
}

export class TcacheApiError extends Error {
  public constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    message: string,
    public readonly upstreamStatus?: number,
  ) {
    super(message);
    this.name = 'TcacheApiError';
  }
}

export async function checkTcacheHealth(
  signal?: AbortSignal,
): Promise<boolean> {
  await requestJson(
    API_ROUTES.tcacheInternalHealth,
    { method: 'GET' },
    HEALTH_TIMEOUT_MS,
    signal,
  );
  return true;
}

export function createTcacheRouteJob(
  request: TcacheRouteCreateRequest,
  signal?: AbortSignal,
): Promise<TcacheApiResult> {
  return requestJson(
    API_ROUTES.tcacheInternalJobs,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    },
    REQUEST_TIMEOUT_MS,
    signal,
  );
}

export async function listTcacheRouteJobs(
  signal?: AbortSignal,
): Promise<unknown> {
  return (
    await requestJson(
      API_ROUTES.tcacheInternalJobs,
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
      signal,
    )
  ).body;
}

export async function getTcacheRouteJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return (
    await requestJson(
      getTcacheRouteJobPath(jobId),
      { method: 'GET' },
      REQUEST_TIMEOUT_MS,
      signal,
    )
  ).body;
}

export async function getTcacheRouteJobResult(
  jobId: string,
  signal?: AbortSignal,
): Promise<TcacheApiResult> {
  return requestJson(
    `${getTcacheRouteJobPath(jobId)}/result`,
    { method: 'GET' },
    REQUEST_TIMEOUT_MS,
    signal,
  );
}

export function cancelTcacheRouteJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<TcacheApiResult> {
  return requestJson(
    `${getTcacheRouteJobPath(jobId)}/cancel`,
    { method: 'POST' },
    REQUEST_TIMEOUT_MS,
    signal,
  );
}

export async function subscribeTcacheRouteJobEvents(
  jobId: string,
  options: TcacheRouteSubscriptionOptions,
): Promise<void> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (options.lastEventId) {
    headers['Last-Event-ID'] = options.lastEventId;
  }
  let response: Response;
  try {
    response = await fetch(getTcacheRouteJobEventsPath(jobId), {
      headers,
      signal: options.signal,
    });
  } catch (cause) {
    if (options.signal.aborted) {
      throw cause;
    }
    throw new TcacheApiError(
      0,
      'TCACHE_UNREACHABLE',
      'tcache SSE gateway에 연결할 수 없습니다.',
    );
  }
  if (!response.ok) {
    const body = await readBody(response);
    const normalized = parseError(body);
    throw new TcacheApiError(
      response.status,
      normalized.code,
      normalized.message,
      normalized.upstreamStatus,
    );
  }
  if (
    response.body === null ||
    !response.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('text/event-stream')
  ) {
    throw new TcacheApiError(
      502,
      'TCACHE_INVALID_SSE_RESPONSE',
      'tcache SSE 응답 형식이 올바르지 않습니다.',
    );
  }

  options.onOpen();
  await parseEventStream(response.body, options.onEvent);
}

export function getTcacheRouteJobPath(jobId: string): string {
  return `${API_ROUTES.tcacheInternalJobs}/${encodeURIComponent(jobId)}`;
}

export function getTcacheRouteJobEventsPath(jobId: string): string {
  return `${getTcacheRouteJobPath(jobId)}/events`;
}

async function requestJson(
  path: string,
  init: RequestInit,
  timeoutMs: number,
  callerSignal?: AbortSignal,
): Promise<TcacheApiResult> {
  const startedAt = performance.now();
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;
  let response: Response;
  try {
    response = await fetch(path, { ...init, signal });
  } catch (cause) {
    if (callerSignal?.aborted) {
      throw cause;
    }
    throw new TcacheApiError(
      0,
      timeoutSignal.aborted ? 'TCACHE_TIMEOUT' : 'TCACHE_UNREACHABLE',
      timeoutSignal.aborted
        ? 'tcache 요청 제한 시간을 초과했습니다.'
        : 'Trasolve tcache gateway에 연결할 수 없습니다.',
    );
  }
  const body = await readBody(response);
  const durationMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    const normalized = parseError(body);
    throw new TcacheApiError(
      response.status,
      normalized.code,
      normalized.message,
      normalized.upstreamStatus,
    );
  }
  return { httpStatus: response.status, body, durationMs };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function parseError(body: unknown): {
  code: string;
  message: string;
  upstreamStatus?: number;
} {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null
  ) {
    const error = body.error as Record<string, unknown>;
    if (typeof error.code === 'string' && typeof error.message === 'string') {
      return {
        code: error.code,
        message: error.message,
        ...(typeof error.upstreamStatus === 'number'
          ? { upstreamStatus: error.upstreamStatus }
          : {}),
      };
    }
  }
  return {
    code: 'TCACHE_REQUEST_FAILED',
    message: 'tcache gateway 요청이 실패했습니다.',
  };
}

async function parseEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: TcacheRouteSseEvent) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let eventId: string | undefined;
  let dataLines: string[] = [];
  let rawLines: string[] = [];

  const dispatch = (): void => {
    if (dataLines.length > 0) {
      onEvent({
        type: eventType || 'message',
        ...(eventId === undefined ? {} : { id: eventId }),
        data: dataLines.join('\n'),
        raw: [...rawLines, ''].join('\n'),
      });
    }
    eventType = '';
    dataLines = [];
    rawLines = [];
  };
  const consumeLine = (line: string): void => {
    if (line === '') {
      dispatch();
      return;
    }
    rawLines.push(line);
    if (line.startsWith(':')) {
      return;
    }
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      eventType = value;
    } else if (field === 'data') {
      dataLines.push(value);
    } else if (field === 'id' && !value.includes('\0')) {
      eventId = value;
    }
  };

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(consumeLine);
  }
  buffer += decoder.decode();
  if (buffer) {
    consumeLine(buffer);
  }
  dispatch();
}
