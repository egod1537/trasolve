import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createServer as createPortProbe } from 'node:net';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_ROUTES,
  isTrouteJobTerminalStatus,
  trouteJobEventSchema,
  trouteOptimizeRequestSchema,
  type TrouteErrorEvent,
  type TrouteOptimizeResponse,
  type TrouteProgressEvent,
  type TrouteResultEvent,
} from '@trasolve/shared';
import { TrouteInboundHttpService } from '../src/internal/troute/trouteInboundHttpService.js';
import {
  TrouteJobRepository,
  TrouteJobRepositoryError,
} from '../src/internal/troute/trouteJobRepository.js';

const host = '127.0.0.1';
let backend: ReturnType<typeof spawn> | null = null;
let baseUrl = '';
let backendOutput = '';

before(async () => {
  const port = await findAvailablePort();
  baseUrl = `http://${host}:${port}`;
  const backendRoot = fileURLToPath(new URL('../', import.meta.url));
  const entryPath = fileURLToPath(new URL('../src/index.ts', import.meta.url));
  const child = spawn(process.execPath, ['--import', 'tsx', entryPath], {
    cwd: backendRoot,
    env: { ...process.env, HOST: host, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backend = child;
  child.stdout?.on('data', (chunk: Buffer) => {
    backendOutput += chunk.toString('utf8');
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    backendOutput += chunk.toString('utf8');
  });
  await waitForBackend();
});

after(async () => {
  const child = backend;
  backend = null;
  if (!child || child.exitCode !== null) {
    return;
  }
  child.kill();
  await once(child, 'exit');
});

test('GET returns the stable troute inbound health response', async () => {
  const response = await fetch(`${baseUrl}${API_ROUTES.trouteInternalHealth}`);

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('content-type'),
    'application/json; charset=utf-8',
  );
  assert.equal(await response.text(), '{"status":"ok","service":"trasolve"}');
});

test('unsupported methods return the normalized 405 response', async () => {
  const response = await fetch(`${baseUrl}${API_ROUTES.trouteInternalHealth}`, {
    method: 'POST',
  });

  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.deepEqual(await response.json(), {
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'GET 요청을 사용해 주세요.',
    },
  });
});

test('existing health and outbound troute routes remain available', async () => {
  const healthResponse = await fetch(`${baseUrl}${API_ROUTES.health}`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const outboundResponse = await fetch(
    `${baseUrl}${API_ROUTES.trouteOptimize}`,
  );
  assert.equal(outboundResponse.status, 405);
  assert.equal(outboundResponse.headers.get('allow'), 'POST');
  const outboundBody = (await outboundResponse.json()) as {
    error: { code: string };
  };
  assert.equal(outboundBody.error.code, 'METHOD_NOT_ALLOWED');
});

test('optimize contract requires a valid opaque job id', () => {
  const validRequest = {
    job_id: 'route-contract-001',
    locations: [
      {
        id: 'start',
        place_id: 'GOOGLE_PLACE_ID',
        open_time: '09:00',
        close_time: '18:00',
        stay_minutes: 30,
      },
    ],
    start_location_id: 'start',
    start_time: '09:00',
  };

  assert.equal(
    trouteOptimizeRequestSchema.safeParse(validRequest).success,
    true,
  );
  assert.equal(
    trouteOptimizeRequestSchema.safeParse({ ...validRequest, job_id: '   ' })
      .success,
    false,
  );
  assert.equal(
    trouteOptimizeRequestSchema.safeParse({
      ...validRequest,
      job_id: 'x'.repeat(129),
    }).success,
    false,
  );
});

test('valid progress updates derived job state', () => {
  const jobs = new TrouteJobRepository();
  const created = jobs.create('route-progress');
  assert.equal(created.status, 'pending');
  assert.equal(created.progress, 0);
  assert.equal(created.stage, null);
  const state = jobs.acceptEvent(
    'route-progress',
    progressEvent(1, 20, 'building_matrix'),
  );

  assert.equal(state.status, 'running');
  assert.equal(state.stage, 'building_matrix');
  assert.equal(state.progress, 20);
  assert.equal(state.last_message, 'Progress 20');
  assert.equal(state.events.length, 1);
});

test('progress cannot decrease within one job', () => {
  const jobs = new TrouteJobRepository();
  jobs.create('route-monotonic');
  jobs.acceptEvent('route-monotonic', progressEvent(1, 60, 'solving'));

  assert.throws(
    () =>
      jobs.acceptEvent('route-monotonic', progressEvent(2, 59, 'scheduling')),
    (cause: unknown) =>
      cause instanceof TrouteJobRepositoryError &&
      cause.kind === 'progress_decreased',
  );
});

test('later progress must use running status', () => {
  const jobs = new TrouteJobRepository();
  jobs.create('route-progress-status');
  jobs.acceptEvent('route-progress-status', progressEvent(1, 0, 'accepted'));

  assert.throws(
    () =>
      jobs.acceptEvent('route-progress-status', {
        ...progressEvent(2, 10, 'accepted'),
        data: {
          ...progressEvent(2, 10, 'accepted').data,
          status: 'queued',
        },
      }),
    (cause: unknown) =>
      cause instanceof TrouteJobRepositoryError &&
      cause.kind === 'progress_status_conflict',
  );
});

test('progress schema rejects invalid stages and values outside 0..100', () => {
  assert.equal(
    trouteJobEventSchema.safeParse({
      ...progressEvent(1, 20, 'accepted'),
      data: {
        ...progressEvent(1, 20, 'accepted').data,
        stage: 'fetching_places',
      },
    }).success,
    false,
  );
  for (const progress of [-1, 101, 1.5]) {
    assert.equal(
      trouteJobEventSchema.safeParse({
        ...progressEvent(1, 20, 'accepted'),
        data: { ...progressEvent(1, 20, 'accepted').data, progress },
      }).success,
      false,
    );
  }
});

test('error payload is strict and requires an uppercase machine code', () => {
  const validError = {
    sequence: 1,
    type: 'error',
    data: {
      code: 'NO_FEASIBLE_ROUTE',
      message: 'No feasible route was found.',
    },
  };
  assert.equal(trouteJobEventSchema.safeParse(validError).success, true);
  assert.equal(
    trouteJobEventSchema.safeParse({
      ...validError,
      data: { ...validError.data, code: 'no-feasible-route' },
    }).success,
    false,
  );
  assert.equal(
    trouteJobEventSchema.safeParse({
      ...validError,
      data: { ...validError.data, internal: 'not allowed' },
    }).success,
    false,
  );
});

test('error makes a job terminal while exact retries remain idempotent', () => {
  const jobs = new TrouteJobRepository();
  jobs.create('route-failed');
  const event: TrouteErrorEvent = {
    sequence: 1,
    type: 'error',
    data: {
      code: 'NO_FEASIBLE_ROUTE',
      message: 'No feasible route was found.',
      detail: 'All time windows conflict.',
    },
  };

  const failed = jobs.acceptEvent('route-failed', event);
  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.error, event.data);
  assert.equal(jobs.acceptEvent('route-failed', event).events.length, 1);
  assert.throws(
    () => jobs.acceptEvent('route-failed', progressEvent(2, 80, 'scheduling')),
    (cause: unknown) =>
      cause instanceof TrouteJobRepositoryError &&
      cause.kind === 'job_terminal',
  );
});

test('valid result completes the job and is idempotent', () => {
  const jobs = new TrouteJobRepository();
  jobs.create('route-completed');
  jobs.acceptEvent('route-completed', progressEvent(1, 80, 'scheduling'));
  const event = resultEvent(2, 120);

  const completed = jobs.acceptEvent('route-completed', event);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.stage, null);
  assert.equal(completed.progress, 100);
  assert.equal(completed.error, null);
  assert.deepEqual(completed.result, event.data);
  assert.equal(jobs.acceptEvent('route-completed', event).events.length, 2);
  assert.throws(
    () =>
      jobs.acceptEvent('route-completed', progressEvent(3, 100, 'scheduling')),
    (cause: unknown) =>
      cause instanceof TrouteJobRepositoryError &&
      cause.kind === 'job_terminal',
  );
});

test('result event reuses the optimize response validation', () => {
  assert.equal(
    trouteJobEventSchema.safeParse(resultEvent(1, 120)).success,
    true,
  );
  assert.equal(
    trouteJobEventSchema.safeParse({
      ...resultEvent(1, 120),
      data: { route: [], total_travel_minutes: 120 },
    }).success,
    false,
  );
  assert.equal(
    trouteJobEventSchema.safeParse({
      ...resultEvent(1, 120),
      data: {
        ...resultEvent(1, 120).data,
        route: [
          {
            ...resultEvent(1, 120).data.route[0],
            arrival_time: '9:00',
          },
        ],
      },
    }).success,
    false,
  );
});

test('matching synchronous and callback results have no diagnostic', () => {
  const jobs = new TrouteJobRepository();
  jobs.create('route-result-match');
  const result = optimizeResult(120);
  jobs.recordSynchronousResult('route-result-match', result);
  const completed = jobs.acceptEvent('route-result-match', resultEvent(1, 120));

  assert.equal(completed.status, 'completed');
  assert.equal(completed.diagnostic, null);
});

test('callback-first differing result records RESULT_MISMATCH', () => {
  const jobs = new TrouteJobRepository();
  jobs.create('route-result-mismatch');
  jobs.acceptEvent('route-result-mismatch', resultEvent(1, 120));
  const reconciled = jobs.recordSynchronousResult(
    'route-result-mismatch',
    optimizeResult(121),
  );

  assert.deepEqual(reconciled.diagnostic, { code: 'RESULT_MISMATCH' });
  assert.deepEqual(reconciled.result, optimizeResult(120));
  assert.deepEqual(reconciled.events[0], resultEvent(1, 120));
});

test('result callback endpoint exposes the completed result', async () => {
  const jobs = new TrouteJobRepository();
  const jobId = 'route-http-result';
  jobs.create(jobId);
  const inbound = await startInboundServer(jobs);
  const jobUrl = `${inbound.baseUrl}${API_ROUTES.trouteInternalJobs}/${jobId}`;

  try {
    const invalid = await fetch(`${jobUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sequence: 1,
        type: 'result',
        data: { route: [], total_travel_minutes: 120 },
      }),
    });
    assert.equal(invalid.status, 400);

    const accepted = await fetch(`${jobUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(resultEvent(1, 120)),
    });
    assert.equal(accepted.status, 202);

    const completed = (await (await fetch(jobUrl)).json()) as {
      status: string;
      progress: number;
      result: TrouteOptimizeResponse;
      events: unknown[];
    };
    assert.equal(completed.status, 'completed');
    assert.equal(completed.progress, 100);
    assert.deepEqual(completed.result, optimizeResult(120));
    assert.equal(completed.events.length, 1);
  } finally {
    await closeServer(inbound.server);
  }
});

test('event and inspection endpoints expose progress and error state', async () => {
  const jobs = new TrouteJobRepository();
  const jobId = 'route/http inspect';
  jobs.create(jobId);
  const inbound = await startInboundServer(jobs);
  const jobUrl = `${inbound.baseUrl}${API_ROUTES.trouteInternalJobs}/${encodeURIComponent(jobId)}`;

  try {
    const progress = await fetch(`${jobUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progressEvent(1, 40, 'solving')),
    });
    assert.equal(progress.status, 202);

    const running = (await (await fetch(jobUrl)).json()) as {
      status: string;
      stage: string;
      progress: number;
      error: unknown;
      events: unknown[];
    };
    assert.equal(running.status, 'running');
    assert.equal(running.stage, 'solving');
    assert.equal(running.progress, 40);
    assert.equal(running.error, null);

    const errorEvent: TrouteErrorEvent = {
      sequence: 2,
      type: 'error',
      data: {
        code: 'NO_FEASIBLE_ROUTE',
        message: 'No feasible route was found.',
      },
    };
    assert.equal(
      (
        await fetch(`${jobUrl}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorEvent),
        })
      ).status,
      202,
    );
    assert.equal(
      (
        await fetch(`${jobUrl}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorEvent),
        })
      ).status,
      202,
    );

    const failed = (await (await fetch(jobUrl)).json()) as {
      status: string;
      error: { code: string };
      events: unknown[];
    };
    assert.equal(failed.status, 'failed');
    assert.equal(failed.error.code, 'NO_FEASIBLE_ROUTE');
    assert.equal(failed.events.length, 2);

    const terminalConflict = await fetch(`${jobUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progressEvent(3, 80, 'scheduling')),
    });
    assert.equal(terminalConflict.status, 409);
    assert.equal(
      ((await terminalConflict.json()) as { error: { code: string } }).error
        .code,
      'TROUTE_JOB_TERMINAL',
    );
  } finally {
    await closeServer(inbound.server);
  }
});

test('testbed terminal predicate stops polling on failed and completed jobs', () => {
  assert.equal(isTrouteJobTerminalStatus('pending'), false);
  assert.equal(isTrouteJobTerminalStatus('running'), false);
  assert.equal(isTrouteJobTerminalStatus('failed'), true);
  assert.equal(isTrouteJobTerminalStatus('completed'), true);
});

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createPortProbe();
    probe.once('error', reject);
    probe.listen(0, host, () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('테스트용 backend 포트를 할당할 수 없습니다.'));
        return;
      }
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitForBackend(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (backend?.exitCode !== null) {
      throw new Error(`Backend exited before startup:\n${backendOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}${API_ROUTES.health}`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // The child process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Backend did not start:\n${backendOutput}`);
}

function progressEvent(
  sequence: number,
  progress: number,
  stage: TrouteProgressEvent['data']['stage'],
): TrouteProgressEvent {
  return {
    sequence,
    type: 'progress',
    data: {
      status: stage === 'accepted' ? 'queued' : 'running',
      stage,
      progress,
      message: `Progress ${progress}`,
    },
  };
}

function resultEvent(
  sequence: number,
  totalTravelMinutes: number,
): TrouteResultEvent {
  return {
    sequence,
    type: 'result',
    data: optimizeResult(totalTravelMinutes),
  };
}

function optimizeResult(totalTravelMinutes: number): TrouteOptimizeResponse {
  return {
    route: [
      {
        location_id: 'A',
        order: 0,
        arrival_time: '09:00',
        departure_time: '10:00',
      },
    ],
    total_travel_minutes: totalTravelMinutes,
  };
}

async function startInboundServer(
  jobs: TrouteJobRepository,
): Promise<{ server: Server; baseUrl: string }> {
  const service = new TrouteInboundHttpService(jobs);
  const server = createServer((request, response) => {
    void service.handle(request, response);
  });
  server.listen(0, host);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('테스트용 inbound server 포트를 확인할 수 없습니다.');
  }
  return { server, baseUrl: `http://${host}:${address.port}` };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
