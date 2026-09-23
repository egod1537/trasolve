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
import { JobRequestSummary } from '../src/features/troute-testbed/components/detail/JobRequestSummary';
import { JobBuilderContentFlow } from '../src/features/troute-testbed/job-builder/JobBuilderContentFlow';
import { JobBuilderSettings } from '../src/features/troute-testbed/job-builder/JobBuilderSettings';
import { JobBuilderTravelTimeSource } from '../src/features/troute-testbed/job-builder/JobBuilderTravelTimeSource';
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
  createEmptyTravelTimeMatrix,
  DEFAULT_TROUTE_TRAVEL_MODE,
  removeJobBuilderLocation,
  reorderJobBuilderLocation,
  shuffleJobBuilderLocations,
  updateJobBuilderTravelTimeMatrixCell,
  type JobBuilderLocation,
  type JobBuilderState,
} from '../src/features/troute-testbed/job-builder/jobBuilderModel';
import {
  clearTravelTimeMatrix,
  fillMissingTravelTimeMatrix,
  generateTravelTimeMatrix,
  getTravelTimeMatrixGeneratorError,
  NEAR_SYMMETRIC_MAX_DEVIATION_RATIO,
  type JobBuilderMatrixGenerationPattern,
  type TravelTimeMatrixGeneratorOptions,
} from '../src/features/troute-testbed/job-builder/jobBuilderMatrixGenerator';
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
  assert.equal(draft.travelMode, 'TRANSIT');
  assert.equal(
    'travel_time_matrix' in
      jobBuilderToOptimizeRequest(draft, 'default-direct-job'),
    true,
  );
});

test('New Job renders all travel modes and direct matrix guidance', () => {
  const html = renderToStaticMarkup(
    createElement(JobBuilderSettings, {
      state: createDefaultJobBuilderDraft(),
      onChange: () => undefined,
    }),
  );

  assert.match(html, /aria-label="이동수단"/);
  assert.match(html, /value="TRANSIT" selected="">대중교통/);
  assert.match(html, /value="DRIVING">자동차/);
  assert.match(html, /value="WALKING">도보/);
  assert.match(html, /value="BICYCLING">자전거/);
  assert.match(html, /직접 Matrix 입력 시 실제 경로 조회는 생략됩니다/);
});

test('builder sends selected travel mode and request detail displays it', () => {
  const driving = {
    ...createBuilderState('direct', asymmetricMatrix),
    travelMode: 'DRIVING' as const,
  };
  const request = parseBuilderRequest(driving, 'driving-direct-job');
  const body = JSON.parse(createTrouteOptimizeRequestBody(request)) as {
    travel_mode: string;
  };

  assert.equal(request.travel_mode, 'DRIVING');
  assert.equal(body.travel_mode, 'DRIVING');
  assert.equal(trouteOptimizeRequestSchema.safeParse(request).success, true);
  assert.match(
    renderToStaticMarkup(createElement(JobRequestSummary, { request })),
    /자동차 \(DRIVING\)/,
  );
});

test('Raw JSON restores travel mode and defaults a missing mode to TRANSIT', () => {
  const current = createBuilderState('direct', asymmetricMatrix);
  const drivingRequest = parseBuilderRequest(
    { ...current, travelMode: 'DRIVING' },
    'raw-driving-job',
  );
  const legacyInput: TrouteOptimizeRequest = { ...drivingRequest };
  delete legacyInput.travel_mode;
  const legacyRequest = trouteOptimizeRequestSchema.parse(legacyInput);

  assert.equal(
    applyOptimizeRequestToBuilder(current, drivingRequest)?.travelMode,
    'DRIVING',
  );
  assert.equal(
    applyOptimizeRequestToBuilder(current, legacyRequest)?.travelMode,
    DEFAULT_TROUTE_TRAVEL_MODE,
  );
});

test('travel mode survives tcache and direct source changes', () => {
  const driving = {
    ...createBuilderState('direct', asymmetricMatrix),
    travelMode: 'DRIVING' as const,
  };
  const tcacheRequest = parseBuilderRequest(
    { ...driving, travelTimeSource: 'tcache' },
    'driving-tcache-job',
  );
  const directRequest = parseBuilderRequest(
    driving,
    'driving-direct-roundtrip-job',
  );

  assert.equal(tcacheRequest.travel_mode, 'DRIVING');
  assert.equal(directRequest.travel_mode, 'DRIVING');
  assert.equal(
    applyOptimizeRequestToBuilder(driving, tcacheRequest)?.travelMode,
    'DRIVING',
  );
  assert.equal(
    applyOptimizeRequestToBuilder(driving, directRequest)?.travelMode,
    'DRIVING',
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

test('seven New Job presets load the expected location counts', () => {
  assert.deepEqual(
    JOB_BUILDER_PRESETS.map((preset) => [preset.name, preset.locationCount]),
    [
      ['Tokyo 3', 3],
      ['Tokyo 5', 5],
      ['Seoul 3', 3],
      ['Seoul 5', 5],
      ['Seoul 8', 8],
      ['Time Window', 4],
      ['Direct Matrix', 4],
    ],
  );
});

test('Tokyo and Seoul presets use actual Place IDs', () => {
  for (const presetId of [
    'tokyo-3',
    'tokyo-5',
    'seoul-3',
    'seoul-5',
    'seoul-8',
  ]) {
    const preset = getJobBuilderPreset(presetId);
    assert.ok(preset);
    const state = preset.build();
    assert.equal(state.travelTimeSource, 'tcache');
    assert.equal(state.travelMode, 'TRANSIT');
    assert.equal(
      state.locations.every((location) => location.placeId.trim().length > 0),
      true,
    );
  }
});

test('Seoul presets are unique nested tcache location sets', () => {
  const seoul3 = getJobBuilderPreset('seoul-3')?.build();
  const seoul5 = getJobBuilderPreset('seoul-5')?.build();
  const seoul8 = getJobBuilderPreset('seoul-8')?.build();
  assert.ok(seoul3);
  assert.ok(seoul5);
  assert.ok(seoul8);

  assert.equal(seoul3.locations.length, 3);
  assert.equal(seoul5.locations.length, 5);
  assert.equal(seoul8.locations.length, 8);

  for (const state of [seoul3, seoul5, seoul8]) {
    assert.equal(state.travelTimeSource, 'tcache');
    assert.equal(
      new Set(state.locations.map(({ id }) => id)).size,
      state.locations.length,
    );
    assert.equal(
      new Set(state.locations.map(({ placeId }) => placeId)).size,
      state.locations.length,
    );
    assert.equal(
      state.locations.every(({ placeId }) => placeId.trim().length > 0),
      true,
    );
  }

  assert.deepEqual(
    seoul5.locations.slice(0, seoul3.locations.length).map(({ id }) => id),
    seoul3.locations.map(({ id }) => id),
  );
  assert.deepEqual(
    seoul8.locations.slice(0, seoul5.locations.length).map(({ id }) => id),
    seoul5.locations.map(({ id }) => id),
  );
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
  for (const presetId of ['seoul-3', 'seoul-5', 'seoul-8']) {
    const applied = applyJobBuilderPreset(presetId, 7);
    assert.ok(applied);

    assert.equal(applied.selectedLocationId, applied.builder.locations[0]?.id);
    assert.equal(applied.viewportRevision, 8);
  }
});

test('every preset produces a valid New Job draft', () => {
  JOB_BUILDER_PRESETS.forEach((preset) => {
    assert.equal(preset.build().travelMode, 'TRANSIT');
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

test('matrix generator toolbar exposes range, five patterns, seed, and actions', () => {
  const html = renderToStaticMarkup(
    createElement(JobBuilderTravelTimeSource, {
      source: 'direct',
      locations,
      matrix: createEmptyTravelTimeMatrix(locations.length),
      onSourceChange: () => undefined,
      onMatrixCellChange: () => undefined,
      onMatrixChange: () => undefined,
    }),
  );

  assert.match(html, /job-builder-matrix-generator/);
  assert.match(html, /빈 셀 랜덤 채우기/);
  assert.match(html, /전체 재생성/);
  assert.match(html, /비우기/);
  assert.match(html, /방향별 균등 \(Directed Uniform\)/);
  assert.match(html, /대칭 \(Symmetric\)/);
  assert.match(html, /근사 대칭 \(Near Symmetric\)/);
  assert.match(html, /군집형 \(Clustered\)/);
  assert.match(html, /짧은 이동 \+ 긴 이상치/);
  assert.match(html, /value="12345"/);
});

test('all matrix patterns keep the diagonal zero and values in range', () => {
  const patterns: JobBuilderMatrixGenerationPattern[] = [
    'directed-uniform',
    'symmetric',
    'near-symmetric',
    'clustered',
    'short-with-outliers',
  ];

  for (const size of [2, 5, 10]) {
    for (const pattern of patterns) {
      const matrix = generateTravelTimeMatrix(
        createGeneratorOptions({ size, pattern }),
      );
      assert.equal(matrix.length, size);
      matrix.forEach((row, rowIndex) => {
        assert.equal(row.length, size);
        row.forEach((value, columnIndex) => {
          if (rowIndex === columnIndex) {
            assert.equal(value, 0);
          } else {
            assert.ok(value >= 5 && value <= 60);
            assert.equal(Number.isInteger(value), true);
          }
        });
      });
    }
  }
});

test('matrix patterns honor directed, symmetric, and near-symmetric behavior', () => {
  const directed = generateTravelTimeMatrix(
    createGeneratorOptions({ size: 5, pattern: 'directed-uniform' }),
  );
  assert.equal(hasAsymmetricPair(directed), true);

  const symmetric = generateTravelTimeMatrix(
    createGeneratorOptions({ size: 5, pattern: 'symmetric' }),
  );
  symmetric.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      assert.equal(value, symmetric[columnIndex]?.[rowIndex]);
    });
  });

  const nearSymmetric = generateTravelTimeMatrix(
    createGeneratorOptions({
      size: 10,
      pattern: 'near-symmetric',
      minMinutes: 10,
    }),
  );
  for (let rowIndex = 0; rowIndex < nearSymmetric.length; rowIndex += 1) {
    for (
      let columnIndex = rowIndex + 1;
      columnIndex < nearSymmetric.length;
      columnIndex += 1
    ) {
      const forward = nearSymmetric[rowIndex]![columnIndex]!;
      const reverse = nearSymmetric[columnIndex]![rowIndex]!;
      assert.ok(
        Math.abs(forward - reverse) <=
          Math.ceil(forward * NEAR_SYMMETRIC_MAX_DEVIATION_RATIO),
      );
    }
  }
});

test('matrix generation is reproducible by seed', () => {
  const options = createGeneratorOptions({ size: 5, seed: 12_345 });
  const first = generateTravelTimeMatrix(options);
  const repeated = generateTravelTimeMatrix(options);
  const differentSeed = generateTravelTimeMatrix({
    ...options,
    seed: 54_321,
  });

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(differentSeed, first);
});

test('matrix fill preserves values while regenerate replaces and clear empties', () => {
  const options = createGeneratorOptions({ size: 3 });
  const partial = [
    [0, 12, null],
    [null, 0, 20],
    [30, null, 0],
  ];
  const filled = fillMissingTravelTimeMatrix(partial, options);

  assert.equal(filled[0]?.[1], 12);
  assert.equal(filled[1]?.[2], 20);
  assert.equal(filled[2]?.[0], 30);
  assert.equal(
    filled.every((row) => row.every((value) => value !== null)),
    true,
  );

  const previous = [
    [0, 999, 999],
    [999, 0, 999],
    [999, 999, 0],
  ];
  const regenerated = generateTravelTimeMatrix(options);
  regenerated.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (rowIndex !== columnIndex) {
        assert.notEqual(value, previous[rowIndex]?.[columnIndex]);
      }
    });
  });

  assert.deepEqual(clearTravelTimeMatrix(3), [
    [0, null, null],
    [null, 0, null],
    [null, null, 0],
  ]);
});

test('matrix generator rejects invalid ranges and seeds', () => {
  assert.match(
    getTravelTimeMatrixGeneratorError(
      createGeneratorOptions({ minMinutes: -1 }),
    ) ?? '',
    /0 이상의 정수/,
  );
  assert.match(
    getTravelTimeMatrixGeneratorError(
      createGeneratorOptions({ minMinutes: 10.5 }),
    ) ?? '',
    /0 이상의 정수/,
  );
  assert.match(
    getTravelTimeMatrixGeneratorError(
      createGeneratorOptions({ minMinutes: 61, maxMinutes: 60 }),
    ) ?? '',
    /최소 이동시간/,
  );
  assert.match(
    getTravelTimeMatrixGeneratorError(createGeneratorOptions({ seed: -1 })) ??
      '',
    /Seed/,
  );
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
    travelMode: DEFAULT_TROUTE_TRAVEL_MODE,
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

function createGeneratorOptions(
  overrides: Partial<TravelTimeMatrixGeneratorOptions> = {},
): TravelTimeMatrixGeneratorOptions {
  return {
    size: 3,
    minMinutes: 5,
    maxMinutes: 60,
    pattern: 'directed-uniform',
    seed: 12_345,
    ...overrides,
  };
}

function hasAsymmetricPair(matrix: readonly (readonly number[])[]): boolean {
  return matrix.some((row, rowIndex) =>
    row.some(
      (value, columnIndex) =>
        rowIndex !== columnIndex && value !== matrix[columnIndex]?.[rowIndex],
    ),
  );
}

function createSequenceRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}
