import {
  cloneJobBuilderFixtureLocations,
  JOB_BUILDER_PLACE_FIXTURES,
} from '@/features/troute-testbed/job-builder/jobBuilderFixtures';
import {
  createEmptyTravelTimeMatrix,
  DEFAULT_TROUTE_TRAVEL_MODE,
  type JobBuilderLocation,
  type JobBuilderState,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { L } from '@/shared/i18n';

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

const seoulGangnamLocation = {
  ...places.gangnamStation,
  openTime: '09:00',
  closeTime: '22:00',
  stayMinutes: 30,
} as const;

const seoul3Locations = [
  places.seoulStation,
  places.gyeongbokgung,
  seoulGangnamLocation,
] as const;

const seoul5Locations = [
  ...seoul3Locations,
  places.hongikUniversityStation,
  places.starfieldCoexMall,
] as const;

const seoul8Locations = [
  ...seoul5Locations,
  places.myeongdongStation,
  places.dongdaemunStation,
  places.yeouidoStation,
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
    get description() {
      return L(
        'testbed:presets.jOBBUILDERPRESETS.description.fastestSmokeTestUsingRealPlace',
      );
    },
    locations: tokyo3Locations,
  }),
  createPreset({
    id: 'tokyo-5',
    name: 'Tokyo 5',
    get description() {
      return L(
        'testbed:presets.jOBBUILDERPRESETS.description.generalTcCheckDifferenceBetweenInput',
      );
    },
    locations: tokyo5Locations,
  }),
  createPreset({
    id: 'seoul-3',
    name: 'Seoul 3',
    get description() {
      return L(
        'testbed:presets.jOBBUILDERPRESETS.description.smokeTestQuicklyConfirmed3Key',
      );
    },
    locations: seoul3Locations,
  }),
  createPreset({
    id: 'seoul-5',
    name: 'Seoul 5',
    get description() {
      return L(
        'testbed:presets.jOBBUILDERPRESETS.description.tcConfirmingGeneralOptimizationByMixing',
      );
    },
    locations: seoul5Locations,
  }),
  createPreset({
    id: 'seoul-8',
    name: 'Seoul 8',
    get description() {
      return L(
        'testbed:presets.jOBBUILDERPRESETS.description.tcCheckPairQueriesOptimizationResults',
      );
    },
    locations: seoul8Locations,
  }),
  createPreset({
    id: 'time-window',
    name: 'Time Window',
    get description() {
      return L(
        'testbed:presets.jOBBUILDERPRESETS.description.tcVerifyDifferentOperatingHoursResidence',
      );
    },
    locations: timeWindowLocations,
  }),
  createPreset({
    id: 'direct-matrix',
    get name() {
      return L('testbed:jobBuilderTravelTimeSource.text.directMatrix');
    },
    get description() {
      return L(
        'testbed:presets.jOBBUILDERPRESETS.description.tcThatQuicklyVerifiesOnlySolver',
      );
    },
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
  travelMode?: JobBuilderState['travelMode'];
  travelTimeMatrix?: readonly (readonly number[])[];
}): JobBuilderPreset {
  const source = options.travelTimeSource ?? 'tcache';
  const travelMode = options.travelMode ?? DEFAULT_TROUTE_TRAVEL_MODE;
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
        travelMode,
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
