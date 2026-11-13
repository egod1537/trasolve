import { TripPlanSnapshot } from './TripPlanSnapshot';
import { readRequestUserText } from '../ai-command/TripCommandPlanDestination';
import { commandFingerprint } from '../command-console/commandFingerprint';
import {
  commandAiInstructions,
  readCommandProposal,
} from '../command-console/commandAi';
import { useCommandRuntime } from '../command-console/CommandProvider';
import { WorkspaceCommandAction } from '../command-console/WorkspaceCommandAction';
import { useTripData } from '@/features/map-workspace/hooks/useTrip';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { chatMessageSchema } from '@trasolve/shared';
import { MapAiRegion, type ChatRequestPreamble } from '@/features/ai-chat';
import {
  useTripState,
  useTripEditController,
  useTripMode,
} from '../hooks/useTrip';
import { serializeTripCommandPlanState } from '../ai-command/TripCommandPlanFingerprint';
import {
  prepareTripCommandPlan,
  executePreparedTripCommandPlan,
  type PreparedTripCommandPlan,
} from '../ai-command/TripCommandPlanExecutor';
import { useL } from '@/shared/i18n';
import { createTripCommandPlanContext } from '../ai-command/TripCommandPlanContext';
import { createTripCommandPlanSystemMessages } from '../ai-command/TripCommandPlanContextParts';
import { parseTripCommandPlanText } from '../ai-command/TripCommandPlanParser';

type Props = {
  mobileScreen?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current map selection (place IDs in selection order); never synthesized. */
  selectedPlaceIds?: readonly string[];
};

export function TripAiRegion(props: Props) {
  const mode = useTripMode();
  const trip = useTripData();
  return mode === 'edit' ? (
    <EditableTripAiRegion key={trip.id} {...props} />
  ) : (
    <MapAiRegion key={trip.id} singleSession {...props} />
  );
}

function EditableTripAiRegion({ selectedPlaceIds = [], ...props }: Props) {
  const trip = useTripData();
  const runtime = useCommandRuntime();
  const L = useL();
  const getRequestPreamble = async (
    userRequest: string,
  ): Promise<ChatRequestPreamble> => {
    // Freeze the selection at send time, before any await, and return it with
    // the system message. It is stored on that request's answer, so the Plan in
    // the answer is only ever prepared against the selection the model saw.
    const selection = [...selectedPlaceIds];
    const contents = createTripCommandPlanSystemMessages(
      await createTripCommandPlanContext(trip, selection),
    );
    contents?.push(...commandAiInstructions(runtime.available));
    const messages = (contents ?? []).map((content) =>
      chatMessageSchema.safeParse({ role: 'system', content }),
    );
    // A context that cannot be sent whole is never sent in part.
    if (!contents || messages.some((message) => !message.success)) {
      throw new Error(L('errors:chat.error.answerCouldNotBeRetrievedTry'));
    }
    return {
      systemMessages: messages.flatMap((message) =>
        message.success ? [message.data] : [],
      ),
      context: JSON.stringify({
        userRequest,
        version: 1,
        selectedPlaceIds: selection,
        commandTrip: commandFingerprint(trip),
      }),
      tools: ['propose_trip_command_plan'],
    };
  };
  return (
    <MapAiRegion
      {...props}
      singleSession
      persistenceKey={`trasolve.trip-chat.v1:${trip.userId}:${trip.id}`}
      getRequestPreamble={getRequestPreamble}
      notice={<TripRecoveryNotice />}
      renderAssistantActions={renderTripAssistantActions}
    />
  );
}

/** Only recognized structured responses replace the ordinary chat body. */
export function renderTripAssistantActions(content: string, context?: string) {
  if (readCommandProposal(content)) {
    return (
      <WorkspaceCommandAction content={content} requestContext={context} />
    );
  }
  const parsed = parseTripCommandPlanText(content);
  if (parsed.success || parsed.error.kind === 'schema_invalid') {
    return <TripPlanAction content={content} requestContext={context} />;
  }
  return null;
}

const SELECTION_CONTEXT_VERSION = 1;

/**
 * Selection ordinals in a Plan refer to the selection sent with its own
 * request. A missing or malformed context (for example a chat stored before the
 * context was recorded) yields an empty selection, so selection references are
 * rejected instead of being resolved against whatever is selected now.
 */
function readSelectionContext(context: string | undefined): readonly string[] {
  if (context === undefined) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(context);
    if (
      value !== null &&
      typeof value === 'object' &&
      (value as { version?: unknown }).version === SELECTION_CONTEXT_VERSION
    ) {
      const ids = (value as { selectedPlaceIds?: unknown }).selectedPlaceIds;
      if (Array.isArray(ids) && ids.every((id) => typeof id === 'string')) {
        return ids as string[];
      }
    }
  } catch {
    // Fall through: unverifiable context is treated as no selection.
  }
  return [];
}

/**
 * Recovery entry point for an unconfirmed save. It belongs to the Trip session
 * (the controller), not to any Plan card, so closing a card cannot remove it.
 */
function TripRecoveryNotice() {
  const L = useL();
  const { status, error } = useTripState();
  const controller = useTripEditController();
  const unconfirmed =
    useSyncExternalStore(
      controller.subscribeRecovery,
      controller.getRecoverySnapshot,
      controller.getRecoverySnapshot,
    ) === 'unknown_commit';
  const [busy, setBusy] = useState(false);
  if (!unconfirmed) {
    return null;
  }
  const reconcile = async () => {
    setBusy(true);
    try {
      await controller.reconcileUnknownCommit();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="trip-ai-recovery" aria-busy={busy}>
      <p role="alert">
        {error ?? L('map:tripEditController.runSave.error.failedSaveTrip')}
      </p>
      <button
        type="button"
        disabled={busy || status === 'dirty' || status === 'saving'}
        onClick={() => void reconcile()}
      >
        {L('common:action.refresh')}
      </button>
    </div>
  );
}

function TripPlanAction({
  content,
  requestContext,
}: {
  content: string;
  requestContext: string | undefined;
}) {
  const L = useL();
  const { trip, status, error: saveError } = useTripState();
  const controller = useTripEditController();
  const parsed = useMemo(() => {
    const result = parseTripCommandPlanText(content);
    if (!result.success) {
      // Ordinary conversational answers do not create an actionable plan.
      if (result.error.kind === 'json_parse') {
        return null;
      }
      return {
        error: L(
          'map:tripCommandPlanExecutor.prepareTripCommandPlan.message.travelCommandPlanFormatIncorrect',
        ),
      };
    }
    return { plan: result.plan };
  }, [L, content]);
  const [preparation, setPreparation] = useState<{
    parsed: typeof parsed;
    trip: typeof trip;
    prepared?: PreparedTripCommandPlan;
    error?: string;
  } | null>(null);
  const selectedPlaceIds = useMemo(
    () => readSelectionContext(requestContext),
    [requestContext],
  );
  const userRequest = readRequestUserText(requestContext);
  const [busy, setBusy] = useState(false);
  const applyingRef = useRef(false);
  const [closed, setClosed] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  // Owned by the controller so it survives card close/reopen and re-renders.
  const unconfirmed =
    useSyncExternalStore(
      controller.subscribeRecovery,
      controller.getRecoverySnapshot,
      controller.getRecoverySnapshot,
    ) === 'unknown_commit';
  const wasUnconfirmedRef = useRef(unconfirmed);
  useEffect(() => {
    // The recovery notice owns the error while unconfirmed; once resolved, an
    // error recorded before it no longer describes the Trip.
    if (wasUnconfirmedRef.current && !unconfirmed) {
      setExecutionError(null);
    }
    wasUnconfirmedRef.current = unconfirmed;
  }, [unconfirmed]);
  const currentPreparation =
    preparation?.parsed === parsed && preparation.trip === trip
      ? preparation
      : null;
  const prepared = unconfirmed ? null : currentPreparation?.prepared;
  const error = executionError ?? parsed?.error ?? currentPreparation?.error;
  useEffect(() => {
    // Re-run when busy flips back: a failed Apply replaces the Trip while it
    // is still busy, and its Preview must then be regenerated.
    if (closed || busy || applyingRef.current || !parsed?.plan) {
      return;
    }
    const abort = new AbortController();
    void prepareTripCommandPlan(parsed.plan, trip, {
      signal: abort.signal,
      selectedPlaceIds,
      userRequest,
    })
      .then((result) => {
        if (abort.signal.aborted) {
          return;
        }
        setPreparation({
          parsed,
          trip,
          ...(result.success
            ? { prepared: result.prepared }
            : { error: result.error.message }),
        });
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setPreparation({
            parsed,
            trip,
            error: L(
              'map:tripCommandPlanExecutor.prepareTripCommandPlan.message.travelCommandPlanFormatIncorrect',
            ),
          });
        }
      });
    return () => abort.abort();
  }, [L, busy, closed, parsed, selectedPlaceIds, trip, userRequest]);
  if (closed) {
    return <TripPlanSnapshot trip={trip} />;
  }
  const stale =
    prepared && serializeTripCommandPlanState(trip) !== prepared.baseState;
  const apply = async () => {
    if (applyingRef.current || !prepared || status !== 'ready' || stale) {
      return;
    }
    applyingRef.current = true;
    setBusy(true);
    setExecutionError(null);
    try {
      const result = await executePreparedTripCommandPlan(
        prepared,
        trip,
        controller,
        { persist: true },
      );
      if (result.success) {
        setClosed(true);
      } else {
        // The controller has already re-read the canonical Trip (or blocked
        // further Apply when it could not). A changed Trip regenerates the
        // Preview through the effect above; the user must approve again.
        setExecutionError(result.error.message);
      }
    } catch {
      setExecutionError(
        L(
          'map:tripCommandPlanExecutor.executePreparedTripCommandPlan.message.preparedTravelCommandCannotBeSafely',
        ),
      );
    } finally {
      applyingRef.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="trip-ai-plan" aria-busy={busy || (!prepared && !error)}>
      {!prepared && !error && !busy && (
        <p role="status">{L('common:routes.loadingLabel.pageLoading')}</p>
      )}
      {prepared && (
        <div>
          <TripPlanSnapshot trip={prepared.preview.before} />
          <p>→</p>
          <TripPlanSnapshot trip={prepared.preview.after} />
        </div>
      )}
      {busy && (
        <p role="status">{L('map:layerPanelHeader.saveLabel.text.saving')}</p>
      )}
      {!unconfirmed && (error || saveError) && (
        <p role="alert">{saveError ?? error}</p>
      )}
      <button
        type="button"
        disabled={busy || !prepared || !!stale || status !== 'ready'}
        onClick={() => void apply()}
      >
        {L('common:action.apply')}
      </button>
      <button type="button" disabled={busy} onClick={() => setClosed(true)}>
        {L('common:action.cancel')}
      </button>
    </div>
  );
}
