import {
  TROUTE_MAX_DEBUG_JOB_DURATION_MS,
  trouteOptimizeRequestSchema,
} from '@trasolve/shared';
import {
  MIN_VISIT_DURATION_MINUTES,
  VISIT_TIME_GRANULARITY_MINUTES,
} from '@/entities/place';
import { jobBuilderToOptimizeRequest } from '@/features/troute-testbed/job-builder/jobBuilderConversion';
import {
  MAX_STAY_MINUTES,
  getJobBuilderLocationRole,
  type JobBuilderLocationErrors,
  type JobBuilderState,
  type JobBuilderValidation,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMPTY_JOB_IDS: ReadonlySet<string> = new Set();

function isVisitTime(value: string, googleTime?: string): boolean {
  if (!TIME_PATTERN.test(value)) {
    return false;
  }
  return (
    value === googleTime ||
    Number(value.slice(3)) % VISIT_TIME_GRANULARITY_MINUTES === 0
  );
}

export function validateJobBuilderDraft(
  state: JobBuilderState,
  jobId: string,
  existingJobIds: ReadonlySet<string> = EMPTY_JOB_IDS,
): JobBuilderValidation {
  const messages: string[] = [];
  const locationErrors: Record<string, JobBuilderLocationErrors> = {};
  const ids = new Set<string>();
  const placeIds = new Set<string>();

  if (state.locations.length < 2) {
    messages.push('출발지와 도착지를 포함해 장소가 2개 이상 필요합니다.');
  }

  state.locations.forEach((location, index) => {
    const errors: JobBuilderLocationErrors = {};
    const endpoint =
      getJobBuilderLocationRole(index, state.locations.length) !== 'waypoint';
    const minimumStayMinutes = endpoint ? 0 : MIN_VISIT_DURATION_MINUTES;

    if (!location.id.trim() || ids.has(location.id)) {
      messages.push('위치 ID는 비어 있지 않고 서로 달라야 합니다.');
    }
    ids.add(location.id);

    if (state.travelTimeSource === 'tcache' && !location.placeId.trim()) {
      errors.placeId = 'tcache 조회에는 Place ID가 필요합니다.';
      messages.push(`${location.name}: place_id가 필요합니다.`);
    } else if (
      state.travelTimeSource === 'tcache' &&
      placeIds.has(location.placeId)
    ) {
      errors.placeId = '다른 위치와 중복되지 않는 Place ID를 입력하세요.';
      messages.push('각 위치의 place_id는 서로 달라야 합니다.');
    }
    if (state.travelTimeSource === 'tcache' && location.placeId.trim()) {
      placeIds.add(location.placeId);
    }

    if (
      !isVisitTime(location.openTime, location.googleOpeningWindow?.openTime)
    ) {
      errors.openTime = `영업 시작 시각을 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;
    }
    if (
      !isVisitTime(location.closeTime, location.googleOpeningWindow?.closeTime)
    ) {
      errors.closeTime = `영업 종료 시각을 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;
    }
    if (
      !errors.openTime &&
      !errors.closeTime &&
      location.openTime > location.closeTime
    ) {
      errors.closeTime = '종료 시각은 시작 시각보다 빠를 수 없습니다.';
    }
    if (
      !Number.isInteger(location.stayMinutes) ||
      location.stayMinutes < minimumStayMinutes ||
      location.stayMinutes > MAX_STAY_MINUTES ||
      location.stayMinutes % VISIT_TIME_GRANULARITY_MINUTES !== 0
    ) {
      errors.stayMinutes = `${minimumStayMinutes}~${MAX_STAY_MINUTES}분 사이에서 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;
    }
    if (Object.keys(errors).length > 0) {
      locationErrors[location.id] = errors;
    }
  });

  const startTimeError = isVisitTime(state.startTime)
    ? undefined
    : `시작 시각을 ${VISIT_TIME_GRANULARITY_MINUTES}분 단위로 입력하세요.`;
  if (startTimeError) {
    messages.push(startTimeError);
  }
  const minJobDurationMsError =
    state.debug.enabled &&
    (!Number.isInteger(state.debug.minJobDurationMs) ||
      state.debug.minJobDurationMs < 0 ||
      state.debug.minJobDurationMs > TROUTE_MAX_DEBUG_JOB_DURATION_MS)
      ? `최소 실행 시간은 0~${TROUTE_MAX_DEBUG_JOB_DURATION_MS}ms 사이의 정수여야 합니다.`
      : undefined;
  if (minJobDurationMsError) {
    messages.push(minJobDurationMsError);
  }
  if (Object.keys(locationErrors).length > 0) {
    messages.push('위치별 입력값을 확인하세요.');
  }

  const directMatrixComplete =
    state.travelTimeSource !== 'direct' || isCompleteTravelTimeMatrix(state);
  if (!directMatrixComplete) {
    messages.push(
      '직접 Matrix의 모든 비대각선 셀에 0 이상의 정수를 입력하세요.',
    );
  }

  const request = jobBuilderToOptimizeRequest(state, jobId);
  const parsedRequest = trouteOptimizeRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    messages.push(
      ...parsedRequest.error.issues
        .filter(
          (issue) =>
            directMatrixComplete || issue.path[0] !== 'travel_time_matrix',
        )
        .map(
          (issue) =>
            `요청 ${issue.path.map(String).join('.')}: ${issue.message}`,
        ),
    );
  }
  if (existingJobIds.has(jobId)) {
    messages.push(`현재 세션에 "${jobId}" Job이 이미 있습니다.`);
  }

  const uniqueMessages = [...new Set(messages)];
  return {
    valid: uniqueMessages.length === 0,
    messages: uniqueMessages,
    locationErrors,
    ...(startTimeError ? { startTimeError } : {}),
    ...(minJobDurationMsError ? { minJobDurationMsError } : {}),
  };
}

function isCompleteTravelTimeMatrix(state: JobBuilderState): boolean {
  const locationCount = state.locations.length;
  if (state.travelTimeMatrix.length !== locationCount) {
    return false;
  }
  return state.travelTimeMatrix.every(
    (row, rowIndex) =>
      row.length === locationCount &&
      row.every((value, columnIndex) =>
        rowIndex === columnIndex
          ? value === 0
          : value !== null && Number.isInteger(value) && value >= 0,
      ),
  );
}
