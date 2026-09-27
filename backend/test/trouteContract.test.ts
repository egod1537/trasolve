import { once } from 'node:events';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  trouteOptimizeRequestSchema,
  trouteOptimizeResponseSchema,
  type TrouteJobState,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { JobEventSubscriptionManager } from '../src/internal/troute/jobEventSubscriptionManager.js';
import { TrouteJobRepository } from '../src/internal/troute/trouteJobRepository.js';
import {
  TrouteClient,
  type TrouteJobEvent,
} from '../src/troute/trouteClient.js';
import { TrouteClientError } from '../src/troute/errors.js';

const jobId = 'route-contract-job';

const latestRequest: TrouteOptimizeRequest = {
  job_id: jobId,
  locations: [
    {
      id: 'start',
      name: 'Start',
      place_id: 'google-place-start',
      open_time: '09:00',
      close_time: '18:00',
      stay_minutes: 0,
    },
    {
      id: 'destination',
      name: 'Destination',
      place_id: 'google-place-destination',
      open_time: '09:00',
      close_time: '18:00',
      stay_minutes: 30,
    },
  ],
  start_policy: 'FIXED',
  start_time: '09:00',
  travel_mode: 'WALKING',
  country_code: 'KR',
  route_provider: 'kakao-maps',
  travel_time_matrix: [
    [0, 20],
    [20, 0],
  ],
  debug: {
    min_job_duration_ms: 0,
    shuffle_result_route: true,
    shuffle_seed: 42,
  },
};

const latestResponse: TrouteOptimizeResponse = {
  route: [
    {
      location_id: 'start',
      order: 0,
      arrival_time: '09:00',
      service_start_time: '09:00',
      departure_time: '09:00',
      wait_minutes: 0,
      stay_minutes: 0,
    },
    {
      location_id: 'destination',
      order: 1,
      arrival_time: '09:20',
      service_start_time: '09:20',
      departure_time: '09:50',
      wait_minutes: 0,
      stay_minutes: 30,
    },
  ],
  total_travel_minutes: 20,
  start_policy: 'FIXED',
  selected_start_time: '09:00',
  solver_candidates: [
    {
      strategy: 'dynamic-programming',
      best: true,
      route: ['start', 'destination'],
      feasible: true,
      objective_score: {
        latest_start: '09:00',
        start_time: '09:00',
        finish_time: '09:50',
        travel_minutes: 20,
        wait_minutes: 0,
      },
      elapsed_ms: 3,
      metadata: {
        state_count: 2,
        frontier_state_count: 1,
        cluster_count: 1,
        cluster_sizes: [2],
        initial_temperature: '100.0',
        final_temperature: '0.1',
        cooling_rate: '0.95',
        seed: 42,
        timed_out: false,
      },
    },
  ],
  solver_diagnostics: {
    total_budget_ms: 5_000,
    total_elapsed_ms: 3,
    baseline_elapsed_ms: 2,
    sa_elapsed_ms: 1,
    sa_run_count: 1,
    global_best_updates: 1,
    termination_reason: 'completed',
  },
  selected_provider: 'kakao-maps',
  provider_selection_reason: 'request override',
  provider_selection_source: 'request-override',
  country_code: 'KR',
  mode: 'WALKING',
};

const failure = {
  code: 'NO_FEASIBLE_ROUTE',
  message: 'No feasible route was found.',
  detail: 'All time windows conflict.',
  failure_detail: {
    type: 'NO_FEASIBLE_ROUTE',
    limiting_location_id: 'destination',
  },
  suggestions: [
    {
      type: 'START_EARLIER',
      reason: 'Start before 09:00.',
      confidence: 'heuristic',
      suggested_latest_start: '08:40',
      priority: 1,
    },
  ],
};

test('canonical SSE snapshot/progress/completed/failed events are parsed', async () => {
  const completedId = `${jobId}-completed`;
  const failedId = `${jobId}-failed`;
  const fixtures: SseFixture[] = [
    canonical('snapshot', pendingState(jobId), 1),
    canonical('progress', runningState(jobId), 2),
    canonical('completed', completedState(completedId), 3),
    canonical('failed', failedState(failedId), 4),
  ];

  const events = await readFixtureEvents(fixtures, [
    jobId,
    jobId,
    completedId,
    failedId,
  ]);

  assert.deepEqual(
    events.map((event) => [event.type, event.sequence, event.updatedAt]),
    [
      ['snapshot', 1, 1_001],
      ['progress', 2, 1_002],
      ['completed', 3, 1_003],
      ['failed', 4, 1_004],
    ],
  );
  assert.equal(events[2]?.state.result?.selected_provider, 'kakao-maps');
  assert.equal(
    events[3]?.state.error?.suggestions?.[0]?.suggested_latest_start,
    '08:40',
  );
  assert.equal(events[3]?.state.error?.suggestions?.[0]?.priority, 1);
});

test('legacy flat SSE snapshot/progress/completed/failed events are normalized', async () => {
  const completedId = `${jobId}-legacy-completed`;
  const failedId = `${jobId}-legacy-failed`;
  const fixtures: SseFixture[] = [
    legacy('snapshot', pendingState(jobId), { request: latestRequest }),
    legacy('progress', runningState(jobId)),
    legacy('completed', completedState(completedId)),
    legacy('failed', failedState(failedId)),
  ];

  const events = await readFixtureEvents(fixtures, [
    jobId,
    jobId,
    completedId,
    failedId,
  ]);

  assert.deepEqual(
    events.map((event) => event.type),
    ['snapshot', 'progress', 'completed', 'failed'],
  );
  assert.equal(events[1]?.state.result, null);
  assert.equal(events[1]?.state.error, null);
  assert.equal(events[2]?.state.result?.solver_diagnostics?.sa_run_count, 1);
  assert.deepEqual(
    events[3]?.state.error?.failure_detail,
    failure.failure_detail,
  );
});

test('legacy active event accepts no request and omitted result/error', async () => {
  const [event] = await readFixtureEvents(
    [legacy('progress', runningState(jobId))],
    [jobId],
  );

  assert.equal(event?.state.status, 'running');
  assert.equal(event?.state.result, null);
  assert.equal(event?.state.error, null);
});

test('event type and status mismatches are rejected as invalid responses', async () => {
  const mismatches: SseFixture[] = [
    legacy('progress', completedState(jobId)),
    legacy('completed', runningState(jobId)),
    legacy('failed', runningState(jobId)),
    legacy('cancelled', runningState(jobId)),
  ];

  for (const fixture of mismatches) {
    await assert.rejects(
      () => readFixtureEvents([fixture], [jobId]),
      (cause: unknown) =>
        cause instanceof TrouteClientError && cause.kind === 'invalid_response',
    );
  }
});

test('only legacy SSE uses a numeric SSE id as sequence fallback', async () => {
  let receivedLastEventId: string | undefined;
  const [legacyEvent, canonicalEvent] = await readFixtureEvents(
    [
      {
        ...legacy('progress', runningState(jobId)),
        id: '17',
      },
      {
        event: 'progress',
        id: '19',
        data: {
          updated_at: 1_019,
          state: runningState(jobId),
        },
      },
    ],
    [jobId, jobId],
    {
      lastEventId: '16',
      inspectRequest: (request) => {
        const header = request.headers['last-event-id'];
        receivedLastEventId = Array.isArray(header) ? header[0] : header;
      },
    },
  );

  assert.equal(legacyEvent?.sequence, 17);
  assert.equal(legacyEvent?.lastEventId, '17');
  assert.equal(canonicalEvent?.sequence, undefined);
  assert.equal(canonicalEvent?.lastEventId, '19');
  assert.equal(receivedLastEventId, '16');
});

test('duplicate and old reconnect events do not roll repository state back', () => {
  const repository = new TrouteJobRepository(() => 2_000);
  repository.create(jobId);

  const newest = repository.applyRemoteEvent(runningState(jobId, 60), {
    eventId: '12',
    sequence: 12,
    updatedAt: 1_012,
  });
  const duplicate = repository.applyRemoteEvent(runningState(jobId, 70), {
    eventId: '12',
    sequence: 12,
    updatedAt: 1_013,
  });
  const old = repository.applyRemoteEvent(runningState(jobId, 20), {
    eventId: '11',
    sequence: 11,
    updatedAt: 1_011,
  });

  assert.equal(newest.applied, true);
  assert.equal(duplicate.applied, false);
  assert.equal(old.applied, false);
  assert.equal(repository.get(jobId).progress, 60);
});

test('repeated solver message churn is coalesced without losing terminal state', async () => {
  const repository = new CountingTrouteJobRepository(() => 2_000);
  repository.create(latestRequest);
  const client = {
    async getJob(): Promise<never> {
      throw new Error('Use the existing local mirror.');
    },
    async *openJobEventStream(): AsyncGenerator<TrouteJobEvent> {
      for (let sequence = 1; sequence <= 1_000; sequence += 1) {
        yield remoteEvent(
          'progress',
          {
            ...runningState(jobId, 79),
            last_message: `Running solver search ${sequence}.`,
          },
          sequence,
        );
      }
      yield remoteEvent('completed', completedState(jobId), 1_001);
    },
  } as unknown as TrouteClient;
  const subscriptions = new JobEventSubscriptionManager(repository, client);

  await subscriptions.track(jobId);
  await waitFor(() => repository.get(jobId).status === 'completed');

  assert.equal(repository.persistCount, 2);
  assert.equal(repository.get(jobId).result?.total_travel_minutes, 20);
});

test('latest OptimizeRouteRequest fixture matches the Rust contract', () => {
  const parsed = trouteOptimizeRequestSchema.parse(latestRequest);

  assert.equal(parsed.locations[0]?.name, 'Start');
  assert.equal(parsed.country_code, 'KR');
  assert.equal(parsed.route_provider, 'kakao-maps');
  assert.equal(parsed.debug?.shuffle_seed, 42);
});

test('latest OptimizeRouteResponse fixture matches the Rust contract', () => {
  const parsed = trouteOptimizeResponseSchema.parse(latestResponse);

  assert.equal(parsed.start_policy, 'FIXED');
  assert.equal(parsed.selected_start_time, '09:00');
  assert.equal(parsed.solver_candidates?.[0]?.metadata.timed_out, false);
  assert.equal(parsed.solver_diagnostics?.termination_reason, 'completed');
  assert.equal(parsed.provider_selection_source, 'request-override');
  assert.equal(parsed.mode, 'WALKING');
});

type SseFixture = {
  event: TrouteJobEvent['type'];
  data: unknown;
  id?: string;
};

class CountingTrouteJobRepository extends TrouteJobRepository {
  public persistCount = 0;

  protected override persistRemoteMirror(): void {
    this.persistCount += 1;
  }
}

function canonical(
  event: TrouteJobEvent['type'],
  state: TrouteJobState,
  sequence: number,
): SseFixture {
  return {
    event,
    data: {
      sequence,
      updated_at: 1_000 + sequence,
      state,
    },
  };
}

function legacy(
  event: TrouteJobEvent['type'],
  state: TrouteJobState,
  extra: Record<string, unknown> = {},
): SseFixture {
  const { error, result, ...activeState } = state;
  return {
    event,
    data: {
      ...activeState,
      created_at: 1_000,
      updated_at: 1_001,
      completed_at:
        state.status === 'completed' ||
        state.status === 'failed' ||
        state.status === 'cancelled'
          ? 1_001
          : null,
      ...(result === null ? {} : { result }),
      ...(error === null ? {} : { error }),
      ...extra,
    },
  };
}

function pendingState(id: string): TrouteJobState {
  return {
    job_id: id,
    status: 'pending',
    stage: 'accepted',
    progress: 0,
    last_message: 'Accepted.',
    error: null,
    result: null,
  };
}

function runningState(id: string, progress = 50): TrouteJobState {
  return {
    job_id: id,
    status: 'running',
    stage: 'fetching_travel_times',
    progress,
    last_message: 'Fetching travel times.',
    error: null,
    result: null,
  };
}

function completedState(id: string): TrouteJobState {
  return {
    job_id: id,
    status: 'completed',
    stage: 'finalizing_result',
    progress: 100,
    last_message: 'Completed.',
    error: null,
    result: latestResponse,
  };
}

function failedState(id: string): TrouteJobState {
  return {
    job_id: id,
    status: 'failed',
    stage: 'optimizing_route',
    progress: 75,
    last_message: 'No feasible route.',
    error: failure,
    result: null,
  };
}

function remoteEvent(
  type: TrouteJobEvent['type'],
  state: TrouteJobState,
  sequence: number,
): TrouteJobEvent {
  return {
    type,
    state,
    rawData: '',
    id: String(sequence),
    lastEventId: String(sequence),
    sequence,
    updatedAt: 1_000 + sequence,
  };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for the terminal Job state.');
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

async function readFixtureEvents(
  fixtures: SseFixture[],
  expectedJobIds: string[],
  options: {
    lastEventId?: string;
    inspectRequest?: (request: IncomingMessage) => void;
  } = {},
): Promise<TrouteJobEvent[]> {
  const eventCount = fixtures.length;
  const server = createServer((request, response) => {
    options.inspectRequest?.(request);
    writeSse(response, fixtures);
  });
  const baseUrl = await listen(server);
  const events: TrouteJobEvent[] = [];

  try {
    for (let index = 0; index < eventCount; index += 1) {
      const client = new TrouteClient({ baseUrl, timeoutMs: 2_000 });
      const controller = new AbortController();
      const stream = client.openJobEventStream(expectedJobIds[index] ?? jobId, {
        signal: controller.signal,
        ...(options.lastEventId === undefined
          ? {}
          : { lastEventId: options.lastEventId }),
      });
      const first = await stream.next();
      if (!first.done) {
        events.push(first.value);
      }
      await stream.return(undefined);
    }
    return events;
  } finally {
    await close(server);
  }
}

function writeSse(response: ServerResponse, fixtures: SseFixture[]): void {
  const fixture = fixtures.shift();
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  if (fixture) {
    if (fixture.id !== undefined) {
      response.write(`id: ${fixture.id}\n`);
    }
    response.write(`event: ${fixture.event}\n`);
    response.write(`data: ${JSON.stringify(fixture.data)}\n\n`);
  }
  response.end();
}

async function listen(server: Server): Promise<string> {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Could not allocate a contract test port.');
  }
  return `http://127.0.0.1:${address.port}/api/`;
}

async function close(server: Server): Promise<void> {
  server.close();
  await once(server, 'close');
}
