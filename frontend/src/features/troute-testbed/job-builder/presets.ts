import {
  cloneJobBuilderFixtureLocations,
  JOB_BUILDER_PLACE_FIXTURES,
} from '@/features/troute-testbed/job-builder/jobBuilderFixtures';
import {
  createEmptyTravelTimeMatrix,
  type JobBuilderLocation,
  type JobBuilderState,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';

export interface JobBuilderPreset {
  id: string;
  name: string;
  description: string;
  locationCount: number;
  sourceLabel: 'tcache' | 'direct';
  build(): JobBuilderState;
}

export interface AppliedJobBuilderPreset {
  builder: JobBuilderState;
  selectedLocationId: string | null;
  viewportRevision: number;
}

const places = JOB_BUILDER_PLACE_FIXTURES;

const tokyo3Locations = [
  places.tokyoStation,
  places.shibuyaStation,
  places.shinjukuStation,
] as const;

const tokyo5Locations = [
  places.tokyoStation,
  places.shibuyaStation,
  places.sensoJi,
  places.shinjukuStation,
  places.tokyoTower,
] as const;

const seoul5Locations = [
  places.seoulStation,
  places.lotteWorldTower,
  places.gyeongbokgung,
  places.nSeoulTower,
  places.gangnamStation,
] as const;

const timeWindowLocations = [
  {
    ...places.tokyoStation,
    openTime: '09:00',
    closeTime: '18:00',
    stayMinutes: 30,
  },
  {
    ...places.shibuyaStation,
    openTime: '10:00',
    closeTime: '12:00',
    stayMinutes: 60,
  },
  {
    ...places.shinjukuStation,
    openTime: '13:00',
    closeTime: '16:00',
    stayMinutes: 40,
  },
  {
    ...places.tokyoTower,
    openTime: '09:00',
    closeTime: '20:00',
    stayMinutes: 20,
  },
] as const;

const directMatrixLocations = [
  places.tokyoStation,
  places.shibuyaStation,
  places.shinjukuStation,
  places.tokyoTower,
] as const;

const directTravelTimeMatrix = [
  [0, 12, 25, 31],
  [15, 0, 9, 22],
  [20, 11, 0, 14],
  [28, 18, 16, 0],
] as const;

export const JOB_BUILDER_PRESETS: readonly JobBuilderPreset[] = [
  createPreset({
    id: 'tokyo-3',
    name: 'Tokyo 3',
    description: '실제 Place ID를 사용하는 가장 빠른 smoke test',
    locations: tokyo3Locations,
  }),
  createPreset({
    id: 'tokyo-5',
    name: 'Tokyo 5',
    description: '입력 순서와 최적화 순서 차이를 확인하는 일반 TC',
    locations: tokyo5Locations,
  }),
  createPreset({
    id: 'seoul-5',
    name: 'Seoul 5',
    description: '서울 실제 Place ID로 tcache와 Google 경로를 확인하는 TC',
    locations: seoul5Locations,
  }),
  createPreset({
    id: 'time-window',
    name: 'Time Window',
    description: '서로 다른 운영시간과 체류시간 제약을 검증하는 TC',
    locations: timeWindowLocations,
  }),
  createPreset({
    id: 'direct-matrix',
    name: 'Direct Matrix',
    description: '비대칭 directed matrix로 solver만 빠르게 검증하는 TC',
    locations: directMatrixLocations,
    travelTimeSource: 'direct',
    travelTimeMatrix: directTravelTimeMatrix,
  }),
];

export const DEFAULT_JOB_BUILDER_PRESET_ID = JOB_BUILDER_PRESETS[0]!.id;

export function getJobBuilderPreset(
  presetId: string,
): JobBuilderPreset | undefined {
  return JOB_BUILDER_PRESETS.find((preset) => preset.id === presetId);
}

export function applyJobBuilderPreset(
  presetId: string,
  currentViewportRevision: number,
): AppliedJobBuilderPreset | null {
  const preset = getJobBuilderPreset(presetId);
  if (!preset) {
    return null;
  }
  const builder = preset.build();
  return {
    builder,
    selectedLocationId: builder.locations[0]?.id ?? null,
    viewportRevision: currentViewportRevision + 1,
  };
}

function createPreset(options: {
  id: string;
  name: string;
  description: string;
  locations: readonly JobBuilderLocation[];
  travelTimeSource?: JobBuilderState['travelTimeSource'];
  travelTimeMatrix?: readonly (readonly number[])[];
}): JobBuilderPreset {
  const source = options.travelTimeSource ?? 'tcache';
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    locationCount: options.locations.length,
    sourceLabel: source,
    build: () => {
      const locations = clonePresetLocations(options.locations);
      return {
        locations,
        startTime: '09:00',
        travelTimeSource: source,
        travelTimeMatrix: options.travelTimeMatrix
          ? options.travelTimeMatrix.map((row) => [...row])
          : createEmptyTravelTimeMatrix(locations.length),
        debug: {
          enabled: false,
          minJobDurationMs: 4_000,
          shuffleResultRoute: false,
        },
      };
    },
  };
}

function clonePresetLocations(
  locations: readonly JobBuilderLocation[],
): JobBuilderLocation[] {
  return cloneJobBuilderFixtureLocations(locations).map((location) => ({
    ...location,
  }));
}
