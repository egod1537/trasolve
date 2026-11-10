import { Intent } from '@blueprintjs/core';
import {
  trouteOptimizeRequestSchema,
  type PlaceDetails,
  type TrouteOptimizeRequest,
} from '@trasolve/shared';
import { useMemo, useState } from 'react';
import {
  applyOptimizeRequestToBuilder,
  createVisualJobId,
  jobBuilderToOptimizeRequest,
} from '@/features/troute-testbed/job-builder/jobBuilderConversion';

import {
  addJobBuilderLocation,
  createDefaultJobBuilderDraft,
  createJobBuilderLocation,
  removeJobBuilderLocation,
  reorderJobBuilderLocation,
  shuffleJobBuilderLocations,
  updateJobBuilderTravelTimeMatrixCell,
  type JobBuilderLocation,
  type JobBuilderState,
  type JobBuilderTravelTimeMatrixCell,
  type JobBuilderTravelTimeSource as TravelTimeSource,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';

import { validateJobBuilderDraft } from '@/features/troute-testbed/job-builder/jobBuilderValidation';
import {
  applyJobBuilderPreset,
  DEFAULT_JOB_BUILDER_PRESET_ID,
} from '@/features/troute-testbed/job-builder/presets';
import { useJobBuilderValidation } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';
import { useL } from '@/shared/i18n';
import {
  type Feedback,
  formatSchemaIssues,
} from '@/features/troute-testbed/job-builder/jobBuilderFeedback';

import { type JobBuilderDialogProps } from '@/features/troute-testbed/job-builder/jobBuilderDialogTypes';

export function useJobBuilderDialog({
  existingJobIds,
  onCreate,
}: JobBuilderDialogProps) {
  const L = useL();
  const [jobId, setJobId] = useState(createVisualJobId);
  const [builder, setBuilder] = useState(createDefaultJobBuilderDraft);
  const [presetId, setPresetId] = useState(DEFAULT_JOB_BUILDER_PRESET_ID);
  const [viewportRevision, setViewportRevision] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rawDraft, setRawDraft] = useState<string | null>(null);
  const visualRequest = useMemo(
    () => jobBuilderToOptimizeRequest(builder, jobId),
    [builder, jobId],
  );
  const rawInput = rawDraft ?? JSON.stringify(visualRequest, null, 2);
  const rawDirty = rawDraft !== null;
  const validation = useJobBuilderValidation(builder, jobId, existingJobIds);
  function clearFeedback(): void {
    setRawDraft(null);
    setFeedback(null);
  }
  function addPlace(place: PlaceDetails): string {
    const existing = builder.locations.find(
      (location) => location.placeId === place.id,
    );
    if (existing) {
      setFeedback({
        intent: Intent.PRIMARY,
        message: L(
          'testbed:jobBuilderDialog.addPlace.message.youHaveSelectedPlaceThatAlready',
        ),
      });
      return existing.id;
    }
    const location = createJobBuilderLocation(place);
    setBuilder((current) => addJobBuilderLocation(current, location));
    setSelectedLocationId(location.id);
    clearFeedback();
    return location.id;
  }
  function updateLocation(
    locationId: string,
    patch: Partial<
      Pick<
        JobBuilderLocation,
        'id' | 'name' | 'placeId' | 'openTime' | 'closeTime' | 'stayMinutes'
      >
    >,
  ): void {
    setBuilder((current) => ({
      ...current,
      locations: current.locations.map((location) =>
        location.id === locationId ? { ...location, ...patch } : location,
      ),
    }));
    if (patch.id !== undefined && selectedLocationId === locationId) {
      setSelectedLocationId(patch.id);
    }
    clearFeedback();
  }
  function removeLocation(locationId: string): void {
    const next = removeJobBuilderLocation(builder, locationId);
    setBuilder(next);
    if (selectedLocationId === locationId) {
      setSelectedLocationId(next.locations[0]?.id ?? null);
    }
    clearFeedback();
  }
  function reorderLocation(locationId: string, targetIndex: number): void {
    setBuilder((current) =>
      reorderJobBuilderLocation(current, locationId, targetIndex),
    );
    clearFeedback();
  }
  function shuffleLocations(): void {
    setBuilder((current) => shuffleJobBuilderLocations(current));
    clearFeedback();
  }
  function updateTravelTimeSource(source: TravelTimeSource): void {
    setBuilder((current) => ({ ...current, travelTimeSource: source }));
    clearFeedback();
  }
  function updateTravelTimeMatrixCell(
    rowIndex: number,
    columnIndex: number,
    value: JobBuilderTravelTimeMatrixCell,
  ): void {
    setBuilder((current) =>
      updateJobBuilderTravelTimeMatrixCell(
        current,
        rowIndex,
        columnIndex,
        value,
      ),
    );
    clearFeedback();
  }
  function updateTravelTimeMatrix(
    matrix: JobBuilderTravelTimeMatrixCell[][],
  ): void {
    setBuilder((current) => ({
      ...current,
      travelTimeSource: 'direct',
      travelTimeMatrix: matrix.map((row) => [...row]),
    }));
    clearFeedback();
  }
  function updateSettings(
    patch: Partial<Pick<JobBuilderState, 'startTime' | 'travelMode' | 'debug'>>,
  ): void {
    setBuilder((current) => ({ ...current, ...patch }));
    clearFeedback();
  }
  function loadPreset(): void {
    const applied = applyJobBuilderPreset(presetId, viewportRevision);
    if (!applied) {
      return;
    }
    setBuilder(applied.builder);
    setSelectedLocationId(applied.selectedLocationId);
    setViewportRevision(applied.viewportRevision);
    setRawDraft(null);
    setFeedback(null);
  }
  function validateVisual(): TrouteOptimizeRequest | null {
    const nextValidation = validateJobBuilderDraft(
      builder,
      jobId,
      existingJobIds,
    );
    if (!nextValidation.valid) {
      setFeedback({
        intent: Intent.DANGER,
        message: nextValidation.messages.join(' '),
      });
      return null;
    }

    const parsed = trouteOptimizeRequestSchema.safeParse(visualRequest);
    if (!parsed.success) {
      setFeedback({
        intent: Intent.DANGER,
        message: L(
          'testbed:jobBuilderDialog.validateVisual.message.requestValidationFailed',
          { formatSchemaIssues: formatSchemaIssues(parsed.error.issues) },
        ),
      });
      return null;
    }
    if (existingJobIds.has(parsed.data.job_id)) {
      setFeedback({
        intent: Intent.DANGER,
        message: L(
          'testbed:jobBuilderDialog.validateVisual.message.jobAlreadyExistsCurrentSession',
          { job_id: parsed.data.job_id },
        ),
      });
      return null;
    }
    setFeedback({
      intent: Intent.SUCCESS,
      message: L(
        'testbed:jobBuilderDialog.validateVisual.message.requestValid',
      ),
    });
    return parsed.data;
  }
  function parseRaw(): TrouteOptimizeRequest | null {
    let json: unknown;
    try {
      json = JSON.parse(rawInput) as unknown;
    } catch (cause) {
      setFeedback({
        intent: Intent.DANGER,
        message: L(
          'testbed:jobBuilderDialog.parseRaw.message.jsonParsingFailed',
          {
            value:
              cause instanceof Error
                ? cause.message
                : L(
                    'testbed:jobBuilderDialog.parseRaw.message.makeSureItSValidJson',
                  ),
          },
        ),
      });
      return null;
    }
    const parsed = trouteOptimizeRequestSchema.safeParse(json);
    if (!parsed.success) {
      setFeedback({
        intent: Intent.DANGER,
        message: L(
          'testbed:jobBuilderDialog.validateVisual.message.requestValidationFailed',
          { formatSchemaIssues: formatSchemaIssues(parsed.error.issues) },
        ),
      });
      return null;
    }
    if (existingJobIds.has(parsed.data.job_id)) {
      setFeedback({
        intent: Intent.DANGER,
        message: L(
          'testbed:jobBuilderDialog.validateVisual.message.jobAlreadyExistsCurrentSession',
          { job_id: parsed.data.job_id },
        ),
      });
      return null;
    }
    setFeedback({
      intent: Intent.SUCCESS,
      message: L(
        'testbed:jobBuilderDialog.validateVisual.message.requestValid',
      ),
    });
    return parsed.data;
  }
  function applyRawToForm(): void {
    const request = parseRaw();
    if (!request) {
      return;
    }
    const nextBuilder = applyOptimizeRequestToBuilder(builder, request);
    if (!nextBuilder) {
      setFeedback({
        intent: Intent.WARNING,
        message: L(
          'testbed:jobBuilderDialog.applyRawToForm.message.rawJsonHasLocationsNotSelected',
        ),
      });
      return;
    }
    setBuilder(nextBuilder);
    setJobId(request.job_id);
    setSelectedLocationId(nextBuilder.locations[0]?.id ?? null);
    setRawDraft(null);
    setFeedback({
      intent: Intent.SUCCESS,
      message: L(
        'testbed:jobBuilderDialog.applyRawToForm.message.rawJsonWasAppliedForm',
      ),
    });
  }
  function createJob(): void {
    const request = validateVisual();
    if (request) {
      onCreate(request);
    }
  }
  return {
    L,
    jobId,
    setJobId,
    builder,
    presetId,
    setPresetId,
    viewportRevision,
    selectedLocationId,
    setSelectedLocationId,
    feedback,
    setFeedback,
    setRawDraft,
    rawInput,
    rawDirty,
    validation,
    clearFeedback,
    addPlace,
    updateLocation,
    removeLocation,
    reorderLocation,
    shuffleLocations,
    updateTravelTimeSource,
    updateTravelTimeMatrixCell,
    updateTravelTimeMatrix,
    updateSettings,
    loadPreset,
    validateVisual,
    parseRaw,
    applyRawToForm,
    createJob,
  };
}
