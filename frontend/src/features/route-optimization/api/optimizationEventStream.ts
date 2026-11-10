import {
  trouteJobCancelledEventSchema,
  trouteJobCompletedEventSchema,
  trouteJobFailedEventSchema,
  trouteJobProgressEventSchema,
  trouteJobSnapshotEventSchema,
  trouteJobStateSchema,
  type TrouteJobState,
} from '@trasolve/shared';
import { L } from '@/shared/i18n';
import { type TrouteJobEventType } from '@/features/route-optimization/api/optimizationApiTypes';
import { captureContractViolation } from '@/features/route-optimization/api/optimizationApiErrors';

export function parseOptimizationJobEvent(
  type: TrouteJobEventType,
  data: string,
  jobId: string,
): TrouteJobState {
  let body: unknown;
  try {
    body = JSON.parse(data) as unknown;
  } catch {
    throw captureContractViolation(
      'route-optimization.parse-event',
      L(
        'routeOptimization:routeOptimizationApi.error.optimizationProgressDataNotJsonFormat',
      ),
    );
  }
  const envelope = getOptimizationEventSchema(type).safeParse(body);
  const parsedRawState = trouteJobStateSchema.safeParse(body);
  const rawState = envelope.success
    ? envelope.data.state
    : parsedRawState.success
      ? parsedRawState.data
      : null;
  if (
    !rawState ||
    rawState.job_id !== jobId ||
    (!envelope.success && !eventMatchesState(type, rawState))
  ) {
    throw captureContractViolation(
      'route-optimization.validate-event',
      L(
        'routeOptimization:routeOptimizationApi.error.optimizationProgressDataFormatIncorrect',
      ),
    );
  }
  return rawState;
}

export function eventMatchesState(
  type: TrouteJobEventType,
  state: TrouteJobState,
): boolean {
  switch (type) {
    case 'snapshot':
      return true;
    case 'progress':
      return state.status === 'pending' || state.status === 'running';
    case 'completed':
      return state.status === 'completed' && state.result !== null;
    case 'failed':
      return state.status === 'failed' && state.error !== null;
    case 'cancelled':
      return state.status === 'cancelled';
  }
}

export function getOptimizationEventSchema(type: TrouteJobEventType) {
  switch (type) {
    case 'snapshot':
      return trouteJobSnapshotEventSchema;
    case 'progress':
      return trouteJobProgressEventSchema;
    case 'completed':
      return trouteJobCompletedEventSchema;
    case 'failed':
      return trouteJobFailedEventSchema;
    case 'cancelled':
      return trouteJobCancelledEventSchema;
  }
}

export async function parseOptimizationEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (type: TrouteJobEventType, data: string) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';
  let eventType = '';
  let dataLines: string[] = [];

  const dispatch = (): void => {
    if (dataLines.length > 0 && isTrouteJobEventType(eventType)) {
      onEvent(eventType, dataLines.join('\n'));
    }
    eventType = '';
    dataLines = [];
  };
  const consumeLine = (line: string): void => {
    if (line === '') {
      dispatch();
      return;
    }
    if (line.startsWith(':')) {
      return;
    }
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      eventType = value;
    } else if (field === 'data') {
      dataLines.push(value);
    }
  };

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? '';
    lines.forEach(consumeLine);
  }
  buffer += decoder.decode();
  if (buffer) {
    consumeLine(buffer);
  }
  dispatch();
}

export function isTrouteJobEventType(
  value: string,
): value is TrouteJobEventType {
  return (
    value === 'snapshot' ||
    value === 'progress' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}
