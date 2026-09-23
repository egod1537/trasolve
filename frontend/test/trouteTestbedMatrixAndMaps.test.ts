import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Intent } from '@blueprintjs/core';
import {
  trouteOptimizeRequestSchema,
  type PlaceDetails,
  type TrouteOptimizeRequest,
  type TrouteOptimizeResponse,
} from '@trasolve/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTrouteOptimizeRequestBody } from '../src/features/troute-testbed/api/troute';
import { JobBuilderContentFlow } from '../src/features/troute-testbed/job-builder/JobBuilderContentFlow';
import {
  createInputComparisonLocations,
  createOptimizedMapContent,
} from '../src/features/troute-testbed/components/detail/jobResultMapModel';
import {
  applyOptimizeRequestToBuilder,
  jobBuilderToOptimizeRequest,
} from '../src/features/troute-testbed/job-builder/jobBuilderConversion';
import {
  addJobBuilderLocation,
  canShuffleJobBuilderLocations,
  createDefaultJobBuilderDraft,
  removeJobBuilderLocation,
  reorderJobBuilderLocation,
  shuffleJobBuilderLocations,
  updateJobBuilderTravelTimeMatrixCell,
  type JobBuilderLocation,
  type JobBuilderState,
} from '../src/features/troute-testbed/job-builder/jobBuilderModel';
import { validateJobBuilderDraft } from '../src/features/troute-testbed/job-builder/jobBuilderValidation';
import {
  applyJobBuilderPreset,
  JOB_BUILDER_PRESETS,
  getJobBuilderPreset,
} from '../src/features/troute-testbed/job-builder/presets';

const locations = [
  createBuilderLocation('A', 'place-a', 37.1, 127.1, 0),
  createBuilderLocation('B', 'place-b', 37.2, 127.2, 60),
  createBuilderLocation('C', 'place-c', 37.3, 127.3, 0),
];
const asymmetricMatrix = [
  [0, 11, 12],
  [21, 0, 23],
  [31, 32, 0],
];

test('New Job defaults to direct matrix input', () => {
  const draft = createDefaultJobBuilderDraft();

  assert.equal(draft.travelTimeSource, 'direct');
  assert.equal(
    'travel_time_matrix' in
      jobBuilderToOptimizeRequest(draft, 'default-direct-job'),
    true,
  );
});

test('invalid direct matrix renders validation and feedback before the editor', () => {
  const html = renderToStaticMarkup(
    createElement(
      JobBuilderContentFlow,
      {
        mode: 'visual',
        validationStatus: 'invalid',
        validationErrors: ['Matrix 입력을 확인하세요.'],
        feedback: { intent: Intent.DANGER, message: '요청을 확인하세요.' },
      },
      createElement('div', {
        className: 'job-builder-matrix-editor',
      }),
    ),
  );
  const validationIndex = html.indexOf('job-builder-validation-summary');
  const feedbackIndex = html.indexOf('job-builder-feedback');
  const matrixIndex = html.indexOf('job-builder-matrix-editor');

  assert.ok(validationIndex >= 0);
  assert.ok(feedbackIndex >= 0);
  assert.ok(matrixIndex >= 0);
  assert.ok(validationIndex < matrixIndex);
  assert.ok(feedbackIndex < matrixIndex);
});

test('tcache and Raw JSON content render without the visual validation summary', () => {
  const tcacheHtml = renderToStaticMarkup(
    createElement(
      JobBuilderContentFlow,
      {
        mode: 'visual',
        validationStatus: 'valid',
        validationErrors: [],
        feedback: null,
      },
      createElement('div', { className: 'tcache-content' }),
    ),
  );
  const rawHtml = renderToStaticMarkup(
    createElement(
      JobBuilderContentFlow,
      {
        mode: 'raw',
        validationStatus: 'invalid',
        validationErrors: ['visual-only error'],
        feedback: null,
      },
      createElement('div', { className: 'job-builder-raw-editor' }),
    ),
  );

  assert.match(tcacheHtml, /tcache-content/);
  assert.doesNotMatch(tcacheHtml, /job-builder-validation-summary/);
  assert.match(rawHtml, /job-builder-raw-editor/);
  assert.doesNotMatch(rawHtml, /job-builder-validation-summary/);
});

test('five New Job presets load the expected location counts', () => {
  assert.deepEqual(
    JOB_BUILDER_PRESETS.map((preset) => [preset.name, preset.locationCount]),
    [
      ['Tokyo 3', 3],
      ['Tokyo 5', 5],
      ['Seoul 5', 5],
      ['Time Window', 4],
      ['Direct Matrix', 4],
    ],
  );
});

test('Tokyo and Seoul presets use actual Place IDs', () => {
  for (const presetId of ['tokyo-3', 'tokyo-5', 'seoul-5']) {
    const preset = getJobBuilderPreset(presetId);
    assert.ok(preset);
    const state = preset.build();
    assert.equal(state.travelTimeSource, 'tcache');
    assert.equal(
      state.locations.every((location) => location.placeId.trim().length > 0),
      true,
    );
  }
});

test('Time Window preset carries constrained hours and stay durations', () => {
  const preset = getJobBuilderPreset('time-window');
  assert.ok(preset);
  const state = preset.build();

  assert.deepEqual(
    state.locations.map((location) => [
      location.openTime,
      location.closeTime,
      location.stayMinutes,
    ]),
    [
      ['09:00', '18:00', 30],
      ['10:00', '12:00', 60],
      ['13:00', '16:00', 40],
      ['09:00', '20:00', 20],
    ],
  );
});

test('Direct Matrix preset has a valid asymmetric square matrix', () => {
  const preset = getJobBuilderPreset('direct-matrix');
  assert.ok(preset);
  const state = preset.build();

  assert.equal(state.travelTimeSource, 'direct');
  assert.equal(state.travelTimeMatrix.length, state.locations.length);
  state.travelTimeMatrix.forEach((row, rowIndex) => {
    assert.equal(row.length, state.locations.length);
    assert.equal(row[rowIndex], 0);
  });
  assert.notEqual(
    state.travelTimeMatrix[0]?.[1],
    state.travelTimeMatrix[1]?.[0],
  );
});

test('preset application selects the first location and advances the viewport', () => {
  const applied = applyJobBuilderPreset('seoul-5', 7);
  assert.ok(applied);

  assert.equal(applied.selectedLocationId, applied.builder.locations[0]?.id);
  assert.equal(applied.viewportRevision, 8);
});

test('every preset produces a valid New Job draft', () => {
  JOB_BUILDER_PRESETS.forEach((preset) => {
    const validation = validateJobBuilderDraft(
      preset.build(),
      `preset-${preset.id}`,
    );
    assert.equal(validation.valid, true, validation.messages.join(' '));
  });
});

test('tcache New Job body omits travel_time_matrix', () => {
  const state = createBuilderState('tcache', asymmetricMatrix);
  const request = parseBuilderRequest(state, 'tcache-job');
  const body = JSON.parse(createTrouteOptimizeRequestBody(request)) as Record<
    string,
    unknown
  >;

  assert.equal('travel_time_matrix' in body, false);
  assert.deepEqual(
    (body.locations as Array<{ place_id: string }>).map(
      (location) => location.place_id,
    ),
    ['place-a', 'place-b', 'place-c'],
  );
});

test('direct matrix New Job body sends the exact matrix', () => {
  const state = createBuilderState('direct', asymmetricMatrix);
  const request = parseBuilderRequest(state, 'direct-job');
  const body = JSON.parse(createTrouteOptimizeRequestBody(request)) as {
    travel_time_matrix: number[][];
  };

  assert.deepEqual(body.travel_time_matrix, asymmetricMatrix);
});

test('direct matrix permits empty Place IDs while tcache blocks them', () => {
  const direct = createBuilderState('direct', asymmetricMatrix);
  const emptyPlaceLocations = direct.locations.map((location) => ({
    ...location,
    placeId: '',
  }));
  const directWithEmptyPlaces = { ...direct, locations: emptyPlaceLocations };
  const tcacheWithEmptyPlaces = {
    ...directWithEmptyPlaces,
    travelTimeSource: 'tcache' as const,
  };

  assert.equal(
    validateJobBuilderDraft(directWithEmptyPlaces, 'direct-empty-place-job')
      .valid,
    true,
  );
  assert.equal(
    validateJobBuilderDraft(tcacheWithEmptyPlaces, 'tcache-empty-place-job')
      .valid,
    false,
  );
});

test('matrix editor preserves shape and values across add, remove, and reorder', () => {
  const initial = createBuilderState('direct', asymmetricMatrix);
  const addedLocation = createBuilderLocation('D', 'place-d', 37.4, 127.4, 60);
  const added = addJobBuilderLocation(initial, addedLocation);
  assert.deepEqual(
    added.locations.map((location) => location.id),
    ['A', 'B', 'D', 'C'],
  );
  assert.deepEqual(added.travelTimeMatrix, [
    [0, 11, null, 12],
    [21, 0, null, 23],
    [null, null, 0, null],
    [31, 32, null, 0],
  ]);

  const removed = removeJobBuilderLocation(initial, 'B');
  assert.deepEqual(removed.travelTimeMatrix, [
    [0, 12],
    [31, 0],
  ]);

  const reordered = reorderJobBuilderLocation(initial, 'C', 0);
  assert.deepEqual(
    reordered.locations.map((location) => location.id),
    ['C', 'A', 'B'],
  );
  assert.deepEqual(reordered.travelTimeMatrix, [
    [0, 31, 32],
    [12, 0, 11],
    [23, 21, 0],
  ]);
});

test('shuffle changes location order without changing the location set or selection', () => {
  const initial = createBuilderState('direct', asymmetricMatrix);
  const selectedLocationId = 'B';
  const shuffled = shuffleJobBuilderLocations(
    initial,
    createSequenceRandom([0.5, 0]),
  );

  assert.deepEqual(
    shuffled.locations.map((location) => location.id),
    ['C', 'A', 'B'],
  );
  assert.deepEqual(
    [...shuffled.locations.map((location) => location.id)].sort(),
    ['A', 'B', 'C'],
  );
  assert.equal(
    new Set(shuffled.locations.map((location) => location.id)).size,
    3,
  );
  assert.equal(
    shuffled.locations.find((location) => location.id === selectedLocationId),
    initial.locations.find((location) => location.id === selectedLocationId),
  );
  assert.equal(selectedLocationId, 'B');
});

test('direct matrix shuffle applies the same row and column permutation', () => {
  const shuffled = shuffleJobBuilderLocations(
    createBuilderState('direct', asymmetricMatrix),
    createSequenceRandom([0.5, 0]),
  );

  assert.deepEqual(shuffled.travelTimeMatrix, [
    [0, 31, 32],
    [12, 0, 11],
    [23, 21, 0],
  ]);
});

test('shuffle falls back to rotation when random attempts keep the same order', () => {
  const shuffled = shuffleJobBuilderLocations(
    createBuilderState('direct', asymmetricMatrix),
    () => 0.999,
  );

  assert.deepEqual(
    shuffled.locations.map((location) => location.id),
    ['B', 'C', 'A'],
  );
  assert.deepEqual(shuffled.travelTimeMatrix, [
    [0, 23, 21],
    [32, 0, 31],
    [11, 12, 0],
  ]);
});

test('shuffle is disabled and leaves state unchanged with zero or one location', () => {
  const base = createBuilderState('direct', asymmetricMatrix);
  const empty = { ...base, locations: [], travelTimeMatrix: [] };
  const single = {
    ...base,
    locations: [base.locations[0]!],
    travelTimeMatrix: [[0]],
  };

  assert.equal(canShuffleJobBuilderLocations(empty.locations), false);
  assert.equal(canShuffleJobBuilderLocations(single.locations), false);
  assert.equal(shuffleJobBuilderLocations(empty), empty);
  assert.equal(shuffleJobBuilderLocations(single), single);
});

test('shuffle works in both tcache and direct modes', () => {
  for (const source of ['tcache', 'direct'] as const) {
    const shuffled = shuffleJobBuilderLocations(
      createBuilderState(source, asymmetricMatrix),
      createSequenceRandom([0.5, 0]),
    );
    assert.equal(shuffled.travelTimeSource, source);
    assert.deepEqual(
      shuffled.locations.map((location) => location.id),
      ['C', 'A', 'B'],
    );
  }
});

test('matrix diagonal stays zero and incomplete direct matrix blocks submit', () => {
  const initial = createBuilderState('direct', asymmetricMatrix);
  const diagonalEdit = updateJobBuilderTravelTimeMatrixCell(initial, 1, 1, 99);
  assert.equal(diagonalEdit, initial);
  assert.equal(diagonalEdit.travelTimeMatrix[1]?.[1], 0);

  const incomplete = {
    ...initial,
    travelTimeMatrix: [
      [0, null, 12],
      [21, 0, 23],
      [31, 32, 0],
    ],
  };
  const incompleteValidation = validateJobBuilderDraft(
    incomplete,
    'incomplete-direct-job',
  );
  assert.equal(incompleteValidation.valid, false);
  assert.deepEqual(incompleteValidation.messages, [
    '직접 Matrix의 모든 비대각선 셀에 0 이상의 정수를 입력하세요.',
  ]);
  assert.equal(
    validateJobBuilderDraft(initial, 'complete-direct-job').valid,
    true,
  );
});

test('Raw JSON matrix presence synchronizes the visual source mode', () => {
  const direct = createBuilderState('direct', asymmetricMatrix);
  const tcache = createBuilderState('tcache', asymmetricMatrix);
  const directRequest = parseBuilderRequest(direct, 'raw-direct-job');
  const tcacheRequest = parseBuilderRequest(tcache, 'raw-tcache-job');

  assert.deepEqual(directRequest.travel_time_matrix, asymmetricMatrix);
  assert.equal(tcacheRequest.travel_time_matrix, undefined);
  assert.equal(
    applyOptimizeRequestToBuilder(tcache, directRequest)?.travelTimeSource,
    'direct',
  );
  assert.equal(
    applyOptimizeRequestToBuilder(direct, tcacheRequest)?.travelTimeSource,
    'tcache',
  );
});

test('result comparison maps request A,B,C and optimized A,C,B independently', () => {
  const request = parseBuilderRequest(
    createBuilderState('tcache', asymmetricMatrix),
    'result-order-job',
  );
  const places = createPlaces();
  const optimization = createOptimization(['A', 'C', 'B']);
  const input = createInputComparisonLocations(request.locations, places);
  const optimized = createOptimizedMapContent(
    'completed',
    request.locations,
    optimization,
    places,
  );

  assert.deepEqual(
    input.map((location) => location.request.id),
    ['A', 'B', 'C'],
  );
  assert.equal(optimized.kind, 'ready');
  if (optimized.kind !== 'ready') {
    assert.fail('optimized map should be ready');
  }
  assert.deepEqual(
    optimized.locations.map((location) => location.request.id),
    ['A', 'C', 'B'],
  );
  assert.deepEqual(
    optimized.locations.map((location) => location.position),
    [
      places.get('place-a')!.location,
      places.get('place-c')!.location,
      places.get('place-b')!.location,
    ],
  );
});

test('optimized sequence carries arrival and departure schedule values', () => {
  const request = parseBuilderRequest(
    createBuilderState('tcache', asymmetricMatrix),
    'schedule-job',
  );
  const optimized = createOptimizedMapContent(
    'completed',
    request.locations,
    createOptimization(['A', 'C', 'B']),
    createPlaces(),
  );

  assert.equal(optimized.kind, 'ready');
  if (optimized.kind !== 'ready') {
    assert.fail('optimized map should be ready');
  }
  assert.deepEqual(
    optimized.locations.map((location) => [
      location.stop?.arrival_time,
      location.stop?.departure_time,
    ]),
    [
      ['09:00', '09:10'],
      ['09:20', '09:30'],
      ['09:40', '09:50'],
    ],
  );
});

test('failed and cancelled jobs do not produce an optimized map', () => {
  const request = parseBuilderRequest(
    createBuilderState('tcache', asymmetricMatrix),
    'terminal-job',
  );
  for (const status of ['failed', 'cancelled'] as const) {
    const content = createOptimizedMapContent(
      status,
      request.locations,
      createOptimization(['A', 'C', 'B']),
      null,
    );
    assert.equal(content.kind, 'placeholder');
  }
});

test('unknown optimized location_id becomes a validation error without throwing', () => {
  const request = parseBuilderRequest(
    createBuilderState('tcache', asymmetricMatrix),
    'unknown-location-job',
  );
  const optimization = createOptimization(['A', 'unknown', 'B']);
  const content = createOptimizedMapContent(
    'completed',
    request.locations,
    optimization,
    createPlaces(),
  );

  assert.equal(content.kind, 'error');
  assert.match(content.message, /unknown/);
});

function createBuilderLocation(
  id: string,
  placeId: string,
  lat: number,
  lng: number,
  stayMinutes: number,
): JobBuilderLocation {
  return {
    id,
    placeId,
    name: id,
    location: { lat, lng },
    openTime: '09:00',
    closeTime: '18:00',
    stayMinutes,
  };
}

function createBuilderState(
  travelTimeSource: JobBuilderState['travelTimeSource'],
  travelTimeMatrix: number[][],
): JobBuilderState {
  return {
    locations: locations.map((location) => ({
      ...location,
      location: { ...location.location },
    })),
    startTime: '09:00',
    travelTimeSource,
    travelTimeMatrix: travelTimeMatrix.map((row) => [...row]),
    debug: {
      enabled: false,
      minJobDurationMs: 4_000,
      shuffleResultRoute: false,
    },
  };
}

function parseBuilderRequest(
  state: JobBuilderState,
  jobId: string,
): TrouteOptimizeRequest {
  return trouteOptimizeRequestSchema.parse(
    jobBuilderToOptimizeRequest(state, jobId),
  );
}

function createPlaces(): ReadonlyMap<string, PlaceDetails> {
  return new Map(
    locations.map((location) => [
      location.placeId,
      {
        id: location.placeId,
        name: location.name,
        location: { ...location.location },
      },
    ]),
  );
}

function createOptimization(order: string[]): TrouteOptimizeResponse {
  return {
    route: order.map((locationId, index) => ({
      location_id: locationId,
      order: index,
      arrival_time: `09:${String(index * 20).padStart(2, '0')}`,
      departure_time: `09:${String(index * 20 + 10).padStart(2, '0')}`,
    })),
    total_travel_minutes: 60,
  };
}

function createSequenceRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}
