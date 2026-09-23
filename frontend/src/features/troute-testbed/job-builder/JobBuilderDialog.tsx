import {
  Button,
  ButtonGroup,
  Callout,
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
import { JobBuilderJsonPreview } from '@/features/troute-testbed/job-builder/JobBuilderJsonPreview';
import { JobBuilderLocationList } from '@/features/troute-testbed/job-builder/JobBuilderLocationList';
import { JobBuilderMap } from '@/features/troute-testbed/job-builder/JobBuilderMap';
import {
  addJobBuilderLocation,
  createDefaultJobBuilderDraft,
  createJobBuilderLocation,
  removeJobBuilderLocation,
  reorderJobBuilderLocation,
  updateJobBuilderTravelTimeMatrixCell,
  type JobBuilderLocation,
  type JobBuilderState,
  type JobBuilderTravelTimeMatrixCell,
  type JobBuilderTravelTimeSource as TravelTimeSource,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import { JobBuilderSettings } from '@/features/troute-testbed/job-builder/JobBuilderSettings';
import { JobBuilderTravelTimeSource } from '@/features/troute-testbed/job-builder/JobBuilderTravelTimeSource';
import { validateJobBuilderDraft } from '@/features/troute-testbed/job-builder/jobBuilderValidation';
import { useJobBuilderValidation } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';
import '@/features/troute-testbed/job-builder/job-builder.css';

interface JobBuilderDialogProps {
  isOpen: boolean;
  dark: boolean;
  existingJobIds: ReadonlySet<string>;
  onClose: () => void;
  onCreate: (request: TrouteOptimizeRequest) => void;
}

type BuilderMode = 'visual' | 'raw';

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
  const [mode, setMode] = useState<BuilderMode>('visual');
  const [jobId, setJobId] = useState(createVisualJobId);
  const [builder, setBuilder] = useState(createDefaultJobBuilderDraft);
  const [viewportRevision, setViewportRevision] = useState(0);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rawInput, setRawInput] = useState(() =>
    JSON.stringify(
      jobBuilderToOptimizeRequest(createDefaultJobBuilderDraft(), jobId),
      null,
      2,
    ),
  );

  const visualRequest = useMemo(
    () => jobBuilderToOptimizeRequest(builder, jobId),
    [builder, jobId],
  );
  const validation = useJobBuilderValidation(builder, jobId, existingJobIds);
  const rawRequestValid = useMemo(
    () => isRawRequestValid(rawInput, existingJobIds),
    [existingJobIds, rawInput],
  );

  function clearFeedback(): void {
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
        'placeId' | 'openTime' | 'closeTime' | 'stayMinutes'
      >
    >,
  ): void {
    setBuilder((current) => ({
      ...current,
      locations: current.locations.map((location) =>
        location.id === locationId ? { ...location, ...patch } : location,
      ),
    }));
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

  function updateSettings(
    patch: Partial<Pick<JobBuilderState, 'startTime' | 'debug'>>,
  ): void {
    setBuilder((current) => ({ ...current, ...patch }));
    clearFeedback();
  }

  function resetVisualBuilder(): void {
    const nextBuilder = createDefaultJobBuilderDraft();
    setBuilder(nextBuilder);
    setJobId(createVisualJobId());
    setSelectedLocationId(null);
    setViewportRevision((current) => current + 1);
    setFeedback(null);
  }

  function resetRawRequest(): void {
    const nextJobId = createVisualJobId();
    const nextBuilder = createDefaultJobBuilderDraft();
    setBuilder(nextBuilder);
    setJobId(nextJobId);
    setSelectedLocationId(null);
    setViewportRevision((current) => current + 1);
    setRawInput(
      JSON.stringify(
        jobBuilderToOptimizeRequest(nextBuilder, nextJobId),
        null,
        2,
      ),
    );
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

  function switchToRaw(): void {
    setRawInput(JSON.stringify(visualRequest, null, 2));
    setMode('raw');
    setFeedback(null);
  }

  function switchToVisual(): void {
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
    setFeedback(null);
    setMode('visual');
  }

  function createJob(): void {
    const request = mode === 'visual' ? validateVisual() : parseRaw();
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
        <div className="job-builder-mode-switch">
          <div className="job-builder-mode-actions">
            <ButtonGroup size="small">
              <Button
                active={mode === 'visual'}
                icon="map"
                onClick={() => {
                  if (mode === 'raw') {
                    switchToVisual();
                  }
                }}
              >
                Visual Builder
              </Button>
              <Button
                active={mode === 'raw'}
                icon="code"
                onClick={() => {
                  if (mode === 'visual') {
                    switchToRaw();
                  }
                }}
              >
                Raw JSON
              </Button>
            </ButtonGroup>
            {mode === 'visual' ? (
              <Button
                icon="reset"
                size="small"
                variant="minimal"
                onClick={resetVisualBuilder}
              >
                기본 위치 복원
              </Button>
            ) : null}
          </div>
          <span className={Classes.TEXT_MUTED}>
            {mode === 'visual'
              ? '지도와 위치 목록으로 요청을 구성합니다.'
              : 'Advanced / Debug 편집 모드'}
          </span>
        </div>

        {mode === 'visual' ? (
          <div className="job-builder-visual">
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
              />
            </div>
            <JobBuilderTravelTimeSource
              source={builder.travelTimeSource}
              locations={builder.locations}
              matrix={builder.travelTimeMatrix}
              onSourceChange={updateTravelTimeSource}
              onMatrixCellChange={updateTravelTimeMatrixCell}
            />
            <JobBuilderSettings
              state={builder}
              startTimeError={validation.validation?.startTimeError}
              minJobDurationMsError={
                validation.validation?.minJobDurationMsError
              }
              onChange={updateSettings}
            />
            <JobBuilderJsonPreview
              request={visualRequest}
              valid={validation.isValid}
            />
          </div>
        ) : (
          <RawJsonEditor
            input={rawInput}
            onChange={(input) => {
              setRawInput(input);
              setFeedback(null);
            }}
            onFormat={() => {
              const request = parseRaw();
              if (request) {
                setRawInput(JSON.stringify(request, null, 2));
              }
            }}
            onReset={resetRawRequest}
          />
        )}

        {mode === 'visual' &&
        validation.status === 'invalid' &&
        validation.errors.length > 0 ? (
          <Callout
            className="job-builder-validation-summary"
            compact
            intent={Intent.DANGER}
            role="alert"
          >
            {validation.errors.join(' ')}
          </Callout>
        ) : null}

        {feedback ? (
          <Callout
            className="job-builder-feedback"
            compact
            intent={feedback.intent}
            role={feedback.intent === Intent.DANGER ? 'alert' : 'status'}
          >
            {feedback.message}
          </Callout>
        ) : null}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose}>취소</Button>
            <Button
              icon="play"
              intent={Intent.PRIMARY}
              disabled={
                mode === 'visual' ? !validation.isValid : !rawRequestValid
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
  onChange,
  onFormat,
  onReset,
}: {
  input: string;
  onChange: (input: string) => void;
  onFormat: () => void;
  onReset: () => void;
}) {
  return (
    <section className="job-builder-raw-editor">
      <header>
        <div>
          <h2 className={Classes.HEADING}>Advanced / 요청 JSON</h2>
          <p>Raw JSON은 visual builder와 동시에 편집되지 않습니다.</p>
        </div>
        <ButtonGroup size="small" variant="minimal">
          <Button icon="code" onClick={onFormat}>
            포맷
          </Button>
          <Button icon="reset" onClick={onReset}>
            샘플 복원
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

function isRawRequestValid(
  input: string,
  existingJobIds: ReadonlySet<string>,
): boolean {
  try {
    const parsed = trouteOptimizeRequestSchema.safeParse(
      JSON.parse(input) as unknown,
    );
    return parsed.success && !existingJobIds.has(parsed.data.job_id);
  } catch {
    return false;
  }
}

function formatSchemaIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('; ');
}
