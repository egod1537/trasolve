import {
  createEmptyTravelTimeMatrix,
  type JobBuilderTravelTimeMatrixCell,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';

export const DEFAULT_MATRIX_MIN_MINUTES = 5;
export const DEFAULT_MATRIX_MAX_MINUTES = 60;
export const DEFAULT_MATRIX_GENERATOR_SEED = 12_345;
export const NEAR_SYMMETRIC_MAX_DEVIATION_RATIO = 0.2;

export type JobBuilderMatrixGenerationPattern =
  | 'directed-uniform'
  | 'symmetric'
  | 'near-symmetric'
  | 'clustered'
  | 'short-with-outliers';

export interface TravelTimeMatrixGeneratorOptions {
  size: number;
  minMinutes: number;
  maxMinutes: number;
  pattern: JobBuilderMatrixGenerationPattern;
  seed: number;
}

const MATRIX_GENERATION_PATTERNS: ReadonlySet<JobBuilderMatrixGenerationPattern> =
  new Set([
    'directed-uniform',
    'symmetric',
    'near-symmetric',
    'clustered',
    'short-with-outliers',
  ]);

export function getTravelTimeMatrixGeneratorError(
  options: TravelTimeMatrixGeneratorOptions,
): string | null {
  if (!Number.isSafeInteger(options.size) || options.size < 0) {
    return '장소 수는 0 이상의 정수여야 합니다.';
  }
  if (
    !Number.isSafeInteger(options.minMinutes) ||
    !Number.isSafeInteger(options.maxMinutes) ||
    options.minMinutes < 0 ||
    options.maxMinutes < 0
  ) {
    return '이동시간 범위는 0 이상의 정수로 입력하세요.';
  }
  if (options.minMinutes > options.maxMinutes) {
    return '최소 이동시간은 최대 이동시간보다 클 수 없습니다.';
  }
  if (!Number.isSafeInteger(options.seed) || options.seed < 0) {
    return 'Seed는 0 이상의 정수로 입력하세요.';
  }
  if (!MATRIX_GENERATION_PATTERNS.has(options.pattern)) {
    return '지원하지 않는 Matrix 생성 패턴입니다.';
  }
  return null;
}

export function generateTravelTimeMatrix(
  options: TravelTimeMatrixGeneratorOptions,
): number[][] {
  assertValidOptions(options);
  const random = createSeededRandom(options.seed);
  const matrix = Array.from({ length: options.size }, () =>
    Array<number>(options.size).fill(0),
  );

  switch (options.pattern) {
    case 'symmetric':
      generateSymmetricMatrix(matrix, options, random);
      break;
    case 'near-symmetric':
      generateNearSymmetricMatrix(matrix, options, random);
      break;
    case 'clustered':
      generateClusteredMatrix(matrix, options, random);
      break;
    case 'short-with-outliers':
      generateOutlierMatrix(matrix, options, random);
      break;
    case 'directed-uniform':
      generateDirectedUniformMatrix(matrix, options, random);
      break;
  }

  return matrix;
}

export function fillMissingTravelTimeMatrix(
  matrix: readonly (readonly JobBuilderTravelTimeMatrixCell[])[],
  options: TravelTimeMatrixGeneratorOptions,
): JobBuilderTravelTimeMatrixCell[][] {
  const generated = generateTravelTimeMatrix(options);
  return generated.map((row, rowIndex) =>
    row.map((value, columnIndex) => {
      if (rowIndex === columnIndex) {
        return 0;
      }
      return matrix[rowIndex]?.[columnIndex] ?? value;
    }),
  );
}

export function clearTravelTimeMatrix(
  size: number,
): JobBuilderTravelTimeMatrixCell[][] {
  return createEmptyTravelTimeMatrix(size);
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function assertValidOptions(options: TravelTimeMatrixGeneratorOptions): void {
  const error = getTravelTimeMatrixGeneratorError(options);
  if (error) {
    throw new RangeError(error);
  }
}

function generateDirectedUniformMatrix(
  matrix: number[][],
  options: TravelTimeMatrixGeneratorOptions,
  random: () => number,
): void {
  forEachDirectedEdge(matrix.length, (rowIndex, columnIndex) => {
    matrix[rowIndex]![columnIndex] = randomInteger(
      random,
      options.minMinutes,
      options.maxMinutes,
    );
  });
}

function generateSymmetricMatrix(
  matrix: number[][],
  options: TravelTimeMatrixGeneratorOptions,
  random: () => number,
): void {
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    for (
      let columnIndex = rowIndex + 1;
      columnIndex < matrix.length;
      columnIndex += 1
    ) {
      const value = randomInteger(
        random,
        options.minMinutes,
        options.maxMinutes,
      );
      matrix[rowIndex]![columnIndex] = value;
      matrix[columnIndex]![rowIndex] = value;
    }
  }
}

function generateNearSymmetricMatrix(
  matrix: number[][],
  options: TravelTimeMatrixGeneratorOptions,
  random: () => number,
): void {
  for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
    for (
      let columnIndex = rowIndex + 1;
      columnIndex < matrix.length;
      columnIndex += 1
    ) {
      const base = randomInteger(
        random,
        options.minMinutes,
        options.maxMinutes,
      );
      const magnitude = 0.1 + random() * 0.1;
      const direction = random() < 0.5 ? -1 : 1;
      const reverse = clampInteger(
        Math.round(base * (1 + direction * magnitude)),
        options.minMinutes,
        options.maxMinutes,
      );
      matrix[rowIndex]![columnIndex] = base;
      matrix[columnIndex]![rowIndex] = reverse;
    }
  }
}

function generateClusteredMatrix(
  matrix: number[][],
  options: TravelTimeMatrixGeneratorOptions,
  random: () => number,
): void {
  const clusterCount = matrix.length >= 6 ? 3 : 2;
  const midpoint = Math.floor((options.minMinutes + options.maxMinutes) / 2);
  forEachDirectedEdge(matrix.length, (rowIndex, columnIndex) => {
    const rowCluster = Math.floor((rowIndex * clusterCount) / matrix.length);
    const columnCluster = Math.floor(
      (columnIndex * clusterCount) / matrix.length,
    );
    const sameCluster = rowCluster === columnCluster;
    matrix[rowIndex]![columnIndex] = randomInteger(
      random,
      sameCluster ? options.minMinutes : midpoint,
      sameCluster ? midpoint : options.maxMinutes,
    );
  });
}

function generateOutlierMatrix(
  matrix: number[][],
  options: TravelTimeMatrixGeneratorOptions,
  random: () => number,
): void {
  const midpoint = Math.floor((options.minMinutes + options.maxMinutes) / 2);
  const longRangeMinimum = Math.min(midpoint + 1, options.maxMinutes);
  forEachDirectedEdge(matrix.length, (rowIndex, columnIndex) => {
    const outlier = random() < 0.15;
    matrix[rowIndex]![columnIndex] = randomInteger(
      random,
      outlier ? longRangeMinimum : options.minMinutes,
      outlier ? options.maxMinutes : midpoint,
    );
  });
}

function forEachDirectedEdge(
  size: number,
  callback: (rowIndex: number, columnIndex: number) => void,
): void {
  for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < size; columnIndex += 1) {
      if (rowIndex !== columnIndex) {
        callback(rowIndex, columnIndex);
      }
    }
  }
}

function randomInteger(
  random: () => number,
  minimum: number,
  maximum: number,
): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
