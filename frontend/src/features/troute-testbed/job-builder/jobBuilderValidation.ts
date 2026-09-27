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
import { L } from '@/shared/i18n';

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
    messages.push(
      L('testbed:jobBuilderLocationList.text.youNeedAtLeastTwoLocations'),
    );
  }

  state.locations.forEach((location, index) => {
    const errors: JobBuilderLocationErrors = {};
    const endpoint =
      getJobBuilderLocationRole(index, state.locations.length) !== 'waypoint';
    const minimumStayMinutes = endpoint ? 0 : MIN_VISIT_DURATION_MINUTES;

    if (!location.id.trim()) {
      errors.id = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterLocationId',
      );
      messages.push(
        L(
          'testbed:jobBuilderValidation.validateJobBuilderDraft.text.locationIdsMustBeNonEmpty',
        ),
      );
    } else if (ids.has(location.id)) {
      errors.id = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterIdThatDoesNotOverlap',
      );
      messages.push(
        L(
          'testbed:jobBuilderValidation.validateJobBuilderDraft.text.locationIdsMustBeNonEmpty',
        ),
      );
    }
    ids.add(location.id);

    if (state.travelTimeSource === 'tcache' && !location.placeId.trim()) {
      errors.placeId = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.tcacheLookupRequiresPlaceId',
      );
      messages.push(
        L(
          'testbed:jobBuilderValidation.validateJobBuilderDraft.text.placeIdRequired',
          { name: location.name },
        ),
      );
    } else if (
      state.travelTimeSource === 'tcache' &&
      placeIds.has(location.placeId)
    ) {
      errors.placeId = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterPlaceIdThatDoesNot',
      );
      messages.push(
        L(
          'testbed:jobBuilderValidation.validateJobBuilderDraft.text.placeIdEachLocationMustBe',
        ),
      );
    }
    if (state.travelTimeSource === 'tcache' && location.placeId.trim()) {
      placeIds.add(location.placeId);
    }

    if (
      !isVisitTime(location.openTime, location.googleOpeningWindow?.openTime)
    ) {
      errors.openTime = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterBusinessStartTimeMinutes',
        { VISIT_TIME_GRANULARITY_MINUTES: VISIT_TIME_GRANULARITY_MINUTES },
      );
    }
    if (
      !isVisitTime(location.closeTime, location.googleOpeningWindow?.closeTime)
    ) {
      errors.closeTime = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterClosingTimeMinutes',
        { VISIT_TIME_GRANULARITY_MINUTES: VISIT_TIME_GRANULARITY_MINUTES },
      );
    }
    if (
      !errors.openTime &&
      !errors.closeTime &&
      location.openTime > location.closeTime
    ) {
      errors.closeTime = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.endTimeCannotBeEarlierThan',
      );
    }
    if (
      !Number.isInteger(location.stayMinutes) ||
      location.stayMinutes < minimumStayMinutes ||
      location.stayMinutes > MAX_STAY_MINUTES ||
      location.stayMinutes % VISIT_TIME_GRANULARITY_MINUTES !== 0
    ) {
      errors.stayMinutes = L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterMinutesBetweenMinutes',
        {
          minimumStayMinutes: minimumStayMinutes,
          MAX_STAY_MINUTES: MAX_STAY_MINUTES,
          VISIT_TIME_GRANULARITY_MINUTES: VISIT_TIME_GRANULARITY_MINUTES,
        },
      );
    }
    if (Object.keys(errors).length > 0) {
      locationErrors[location.id] = errors;
    }
  });

  const startTimeError = isVisitTime(state.startTime)
    ? undefined
    : L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterMinimumDepartureTimeMinutes',
        { VISIT_TIME_GRANULARITY_MINUTES: VISIT_TIME_GRANULARITY_MINUTES },
      );
  if (startTimeError) {
    messages.push(startTimeError);
  }
  const minJobDurationMsError =
    state.debug.enabled &&
    (!Number.isInteger(state.debug.minJobDurationMs) ||
      state.debug.minJobDurationMs < 0 ||
      state.debug.minJobDurationMs > TROUTE_MAX_DEBUG_JOB_DURATION_MS)
      ? L(
          'testbed:jobBuilderValidation.validateJobBuilderDraft.text.minimumExecutionTimeMustBeInteger',
          {
            TROUTE_MAX_DEBUG_JOB_DURATION_MS: TROUTE_MAX_DEBUG_JOB_DURATION_MS,
          },
        )
      : undefined;
  if (minJobDurationMsError) {
    messages.push(minJobDurationMsError);
  }
  if (Object.keys(locationErrors).length > 0) {
    messages.push(
      L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.checkInputValuesEachLocation',
      ),
    );
  }

  const directMatrixComplete =
    state.travelTimeSource !== 'direct' || isCompleteTravelTimeMatrix(state);
  if (!directMatrixComplete) {
    messages.push(
      L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.enterIntegerGreaterThanEqual0',
      ),
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
        .map((issue) =>
          L(
            'testbed:jobBuilderValidation.validateJobBuilderDraft.text.request',
            { value: issue.path.map(String).join('.'), message: issue.message },
          ),
        ),
    );
  }
  if (existingJobIds.has(jobId)) {
    messages.push(
      L(
        'testbed:jobBuilderValidation.validateJobBuilderDraft.text.jobAlreadyExistsCurrentSession',
        { jobId: jobId },
      ),
    );
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
