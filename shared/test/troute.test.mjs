import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  trouteOptimizeRequestSchema,
  trouteRemoteJobSchema,
} from '../dist/index.js';

const locations = [
  createLocation('A', 'place-a'),
  createLocation('B', 'place-b'),
  createLocation('C', 'place-c'),
];
const asymmetricMatrix = [
  [0, 11, 12],
  [21, 0, 23],
  [31, 32, 0],
];

test('optimize request accepts requests without a travel time matrix', () => {
  assert.equal(
    trouteOptimizeRequestSchema.safeParse(createRequest()).success,
    true,
  );
});

test('optimize request accepts a valid asymmetric matrix', () => {
  const parsed = trouteOptimizeRequestSchema.safeParse(
    createRequest({ travel_time_matrix: asymmetricMatrix }),
  );

  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.travel_time_matrix, asymmetricMatrix);
});

test('optimize request rejects wrong matrix row and column counts', () => {
  assert.equal(
    trouteOptimizeRequestSchema.safeParse(
      createRequest({ travel_time_matrix: asymmetricMatrix.slice(0, 2) }),
    ).success,
    false,
  );
  assert.equal(
    trouteOptimizeRequestSchema.safeParse(
      createRequest({
        travel_time_matrix: [
          [0, 1],
          [1, 0],
          [1, 2, 0],
        ],
      }),
    ).success,
    false,
  );
});

test('optimize request rejects negative, float, and non-zero diagonal values', () => {
  for (const matrix of [
    [
      [0, -1, 2],
      [3, 0, 4],
      [5, 6, 0],
    ],
    [
      [0, 1.5, 2],
      [3, 0, 4],
      [5, 6, 0],
    ],
    [
      [1, 1, 2],
      [3, 0, 4],
      [5, 6, 0],
    ],
  ]) {
    assert.equal(
      trouteOptimizeRequestSchema.safeParse(
        createRequest({ travel_time_matrix: matrix }),
      ).success,
      false,
    );
  }
});

test('place_id may be empty with a matrix but is required without one', () => {
  const emptyPlaceLocations = locations.map((location) => ({
    ...location,
    place_id: '',
  }));

  assert.equal(
    trouteOptimizeRequestSchema.safeParse(
      createRequest({
        locations: emptyPlaceLocations,
        travel_time_matrix: asymmetricMatrix,
      }),
    ).success,
    true,
  );
  assert.equal(
    trouteOptimizeRequestSchema.safeParse(
      createRequest({ locations: emptyPlaceLocations }),
    ).success,
    false,
  );
});

test('remote jobs reuse the optimize request matrix contract', () => {
  const request = createRequest({ travel_time_matrix: asymmetricMatrix });
  const parsed = trouteRemoteJobSchema.safeParse({
    request,
    job_id: request.job_id,
    status: 'pending',
    stage: null,
    progress: 0,
    last_message: null,
    created_at: 1,
    updated_at: 1,
    completed_at: null,
    result: null,
    error: null,
  });

  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.request.travel_time_matrix, asymmetricMatrix);
});

function createLocation(id, placeId) {
  return {
    id,
    place_id: placeId,
    open_time: '09:00',
    close_time: '18:00',
    stay_minutes: id === 'B' ? 60 : 0,
  };
}

function createRequest(patch = {}) {
  return {
    job_id: 'matrix-contract-job',
    locations,
    start_time: '09:00',
    ...patch,
  };
}
