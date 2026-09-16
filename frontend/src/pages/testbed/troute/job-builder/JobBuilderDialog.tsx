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
import { createSampleRequest } from '../sample';
import {
  applyOptimizeRequestToBuilder,
  createVisualJobId,
  jobBuilderToOptimizeRequest,
} from './jobBuilderConversion';
import { JobBuilderJsonPreview } from './JobBuilderJsonPreview';
import { JobBuilderLocationList } from './JobBuilderLocationList';
import { JobBuilderMap } from './JobBuilderMap';
import {
  addJobBuilderLocation,
  createInitialJobBuilderState,
  createJobBuilderLocation,
  removeJobBuilderLocation,
  reorderJobBuilderLocations,
  validateJobBuilder,
  type JobBuilderLocation,
  type JobBuilderState,
  type JobBuilderValidation,
} from './jobBuilderModel';
import { JobBuilderSettings } from './JobBuilderSettings';
import './job-builder.css';

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
  const [builder, setBuilder] = useState(createInitialJobBuilderState);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [validation, setValidation] = useState<JobBuilderValidation | null>(
    null,
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rawInput, setRawInput] = useState(() =>
    JSON.stringify(
      jobBuilderToOptimizeRequest(createInitialJobBuilderState(), jobId),
      null,
      2,
    ),
  );

  const visualRequest = useMemo(
    () => jobBuilderToOptimizeRequest(builder, jobId),
    [builder, jobId],
  );
  const liveBuilderValidation = useMemo(
    () => validateJobBuilder(builder),
    [builder],
  );
  const previewValid =
    liveBuilderValidation.valid &&
    trouteOptimizeRequestSchema.safeParse(visualRequest).success;

  function clearValidation(): void {
    setValidation(null);
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
    clearValidation();
    return location.id;
  }

  function updateLocation(
    locationId: string,
    patch: Partial<
      Pick<JobBuilderLocation, 'openTime' | 'closeTime' | 'stayMinutes'>
    >,
  ): void {
    setBuilder((current) => ({
      ...current,
      locations: current.locations.map((location) =>
        location.id === locationId ? { ...location, ...patch } : location,
      ),
    }));
    clearValidation();
  }

  function removeLocation(locationId: string): void {
    const next = removeJobBuilderLocation(builder, locationId);
    setBuilder(next);
    if (selectedLocationId === locationId) {
      setSelectedLocationId(next.locations[0]?.id ?? null);
    }
    clearValidation();
  }

  function reorderLocation(locationId: string, targetIndex: number): void {
    setBuilder((current) => ({
      ...current,
      locations: reorderJobBuilderLocations(
        current.locations,
        locationId,
        targetIndex,
      ),
    }));
    clearValidation();
  }

  function updateSettings(patch: Pick<JobBuilderState, 'startTime'>): void {
    setBuilder((current) => ({ ...current, ...patch }));
    clearValidation();
  }

  function validateVisual(): TrouteOptimizeRequest | null {
    const nextValidation = validateJobBuilder(builder);
    setValidation(nextValidation);
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
    setValidation(null);
    setFeedback(null);
    setMode('visual');
  }

  function validateCurrent(): void {
    if (mode === 'visual') {
      validateVisual();
    } else {
      parseRaw();
    }
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
                selectedLocationId={selectedLocationId}
                onSelectLocation={setSelectedLocationId}
                onAddPlace={addPlace}
              />
              <JobBuilderLocationList
                locations={builder.locations}
                selectedLocationId={selectedLocationId}
                errors={validation?.locationErrors ?? {}}
                onSelect={setSelectedLocationId}
                onUpdate={updateLocation}
                onRemove={removeLocation}
                onReorder={reorderLocation}
              />
            </div>
            <JobBuilderSettings
              state={builder}
              startTimeError={validation?.startTimeError}
              onChange={updateSettings}
            />
            <JobBuilderJsonPreview
              request={visualRequest}
              valid={previewValid}
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
            onReset={() => {
              setRawInput(JSON.stringify(createSampleRequest(), null, 2));
              setFeedback(null);
            }}
          />
        )}

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
            <Button icon="tick" onClick={validateCurrent}>
              검증
            </Button>
            <Button
              icon="play"
              intent={Intent.PRIMARY}
              disabled={mode === 'visual' && builder.locations.length < 2}
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

function formatSchemaIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  return issues
    .map((issue) => `${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('; ');
}
