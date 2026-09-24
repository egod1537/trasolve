import {
  Button,
  ButtonGroup,
  Classes,
  Dialog,
  DialogBody,
  DialogFooter,
  Intent,
  TextArea,
} from '@blueprintjs/core';
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
import { JobBuilderContentFlow } from '@/features/troute-testbed/job-builder/JobBuilderContentFlow';
import { JobBuilderLocationList } from '@/features/troute-testbed/job-builder/JobBuilderLocationList';
import { JobBuilderMap } from '@/features/troute-testbed/job-builder/JobBuilderMap';
import { JobBuilderPresetPicker } from '@/features/troute-testbed/job-builder/JobBuilderPresetPicker';
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
import { JobBuilderSettings } from '@/features/troute-testbed/job-builder/JobBuilderSettings';
import { JobBuilderTravelTimeSource } from '@/features/troute-testbed/job-builder/JobBuilderTravelTimeSource';
import { validateJobBuilderDraft } from '@/features/troute-testbed/job-builder/jobBuilderValidation';
import {
  applyJobBuilderPreset,
  DEFAULT_JOB_BUILDER_PRESET_ID,
} from '@/features/troute-testbed/job-builder/presets';
import { useJobBuilderValidation } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';
import '@/features/troute-testbed/job-builder/job-builder.css';

interface JobBuilderDialogProps {
  isOpen: boolean;
  dark: boolean;
  existingJobIds: ReadonlySet<string>;
  onClose: () => void;
  onCreate: (request: TrouteOptimizeRequest) => void;
}

interface Feedback {
  intent: Intent;
  message: string;
}

export function JobBuilderDialog({
  isOpen,
  dark,
  existingJobIds,
  onClose,
  onCreate,
}: JobBuilderDialogProps) {
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
        message: '이미 위치 목록에 있는 장소를 선택했습니다.',
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
        message: `요청 검증 실패: ${formatSchemaIssues(parsed.error.issues)}`,
      });
      return null;
    }
    if (existingJobIds.has(parsed.data.job_id)) {
      setFeedback({
        intent: Intent.DANGER,
        message: `현재 세션에 "${parsed.data.job_id}" Job이 이미 있습니다.`,
      });
      return null;
    }
    setFeedback({ intent: Intent.SUCCESS, message: '요청이 유효합니다.' });
    return parsed.data;
  }

  function parseRaw(): TrouteOptimizeRequest | null {
    let json: unknown;
    try {
      json = JSON.parse(rawInput) as unknown;
    } catch (cause) {
      setFeedback({
        intent: Intent.DANGER,
        message: `JSON 파싱 실패: ${cause instanceof Error ? cause.message : '올바른 JSON인지 확인하세요.'}`,
      });
      return null;
    }
    const parsed = trouteOptimizeRequestSchema.safeParse(json);
    if (!parsed.success) {
      setFeedback({
        intent: Intent.DANGER,
        message: `요청 검증 실패: ${formatSchemaIssues(parsed.error.issues)}`,
      });
      return null;
    }
    if (existingJobIds.has(parsed.data.job_id)) {
      setFeedback({
        intent: Intent.DANGER,
        message: `현재 세션에 "${parsed.data.job_id}" Job이 이미 있습니다.`,
      });
      return null;
    }
    setFeedback({ intent: Intent.SUCCESS, message: '요청이 유효합니다.' });
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
        message:
          'Raw JSON에 지도에서 선택하지 않은 위치가 있어 visual mode로 변환할 수 없습니다. Raw JSON mode에서 Job을 생성하거나 visual builder를 새로 시작하세요.',
      });
      return;
    }
    setBuilder(nextBuilder);
    setJobId(request.job_id);
    setSelectedLocationId(nextBuilder.locations[0]?.id ?? null);
    setRawDraft(null);
    setFeedback({
      intent: Intent.SUCCESS,
      message: 'Raw JSON을 Form에 적용했습니다.',
    });
  }

  function createJob(): void {
    const request = validateVisual();
    if (request) {
      onCreate(request);
    }
  }

  return (
    <Dialog
      className="job-builder-dialog"
      isOpen={isOpen}
      onClose={onClose}
      portalClassName={dark ? Classes.DARK : undefined}
      title="새 Job"
      icon="new-object"
      canEscapeKeyClose
      canOutsideClickClose={false}
    >
      <DialogBody className="job-builder-dialog-body">
        <JobBuilderContentFlow
          validationStatus={validation.status}
          validationErrors={validation.errors}
          feedback={feedback}
        >
          <div className="job-builder-visual">
            <JobBuilderSettings
              jobId={jobId}
              state={builder}
              startTimeError={validation.validation?.startTimeError}
              minJobDurationMsError={
                validation.validation?.minJobDurationMsError
              }
              onJobIdChange={(nextJobId) => {
                setJobId(nextJobId);
                clearFeedback();
              }}
              onChange={updateSettings}
            />
            <JobBuilderPresetPicker
              presetId={presetId}
              onPresetChange={setPresetId}
              onApply={loadPreset}
            />
            <div className="job-builder-main-grid">
              <JobBuilderMap
                locations={builder.locations}
                viewportRevision={viewportRevision}
                selectedLocationId={selectedLocationId}
                onSelectLocation={setSelectedLocationId}
                onAddPlace={addPlace}
              />
              <JobBuilderLocationList
                locations={builder.locations}
                placeIdRequired={builder.travelTimeSource === 'tcache'}
                selectedLocationId={selectedLocationId}
                errors={validation.validation?.locationErrors ?? {}}
                validationStatus={validation.status}
                validationErrorCount={validation.errorCount}
                onSelect={setSelectedLocationId}
                onUpdate={updateLocation}
                onRemove={removeLocation}
                onReorder={reorderLocation}
                onShuffle={shuffleLocations}
              />
            </div>
            <JobBuilderTravelTimeSource
              source={builder.travelTimeSource}
              locations={builder.locations}
              matrix={builder.travelTimeMatrix}
              onSourceChange={updateTravelTimeSource}
              onMatrixCellChange={updateTravelTimeMatrixCell}
              onMatrixChange={updateTravelTimeMatrix}
            />
            <RawJsonEditor
              input={rawInput}
              dirty={rawDirty}
              onChange={(input) => {
                setRawDraft(input);
                setFeedback(null);
              }}
              onApply={applyRawToForm}
              onFormat={() => {
                const request = parseRaw();
                if (request) {
                  setRawDraft(JSON.stringify(request, null, 2));
                }
              }}
              onReset={() => {
                setRawDraft(null);
                setFeedback(null);
              }}
            />
          </div>
        </JobBuilderContentFlow>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose}>취소</Button>
            <Button
              icon="tick"
              onClick={rawDirty ? applyRawToForm : validateVisual}
            >
              검증
            </Button>
            <Button
              icon="play"
              intent={Intent.PRIMARY}
              disabled={!validation.isValid || rawDirty}
              title={
                rawDirty
                  ? 'Raw JSON 변경사항을 먼저 Form에 적용하세요.'
                  : undefined
              }
              onClick={createJob}
            >
              Job 생성
            </Button>
          </>
        }
      />
    </Dialog>
  );
}

function RawJsonEditor({
  input,
  dirty,
  onChange,
  onApply,
  onFormat,
  onReset,
}: {
  input: string;
  dirty: boolean;
  onChange: (input: string) => void;
  onApply: () => void;
  onFormat: () => void;
  onReset: () => void;
}) {
  return (
    <section className="job-builder-raw-editor">
      <header>
        <div>
          <h2 className={Classes.HEADING}>Raw JSON</h2>
          <p>
            Form과 같은 요청을 표시합니다. JSON을 수정한 뒤 Form에 적용하면
            양방향 변환됩니다.
          </p>
        </div>
        <ButtonGroup size="small" variant="minimal">
          <Button icon="code" onClick={onFormat}>
            포맷
          </Button>
          <Button icon="reset" onClick={onReset}>
            Form에서 복원
          </Button>
          <Button
            icon="import"
            intent={dirty ? Intent.PRIMARY : Intent.NONE}
            disabled={!dirty}
            onClick={onApply}
          >
            Form에 적용
          </Button>
        </ButtonGroup>
      </header>
      <TextArea
        aria-label="요청 JSON"
        className="job-builder-raw-textarea"
        fill
        spellCheck={false}
        autoCapitalize="off"
        value={input}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}

function formatSchemaIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('; ');
}
