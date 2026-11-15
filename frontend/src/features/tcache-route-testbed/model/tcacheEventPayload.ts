import type { TcacheRouteJob } from '@/features/tcache-route-testbed/model/types';

export function unwrapEventPayload(
  value: unknown,
): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  const nested = value.state ?? value.job ?? value.data;
  return isRecord(nested) ? nested : value;
}

export function normalizeEventStatus(
  value: unknown,
): TcacheRouteJob['status'] | undefined {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  ) {
    return value;
  }
  if (value === 'pending' || value === 'accepted') {
    return 'queued';
  }
  return undefined;
}

export function readEventString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}

export function readEventNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  return typeof value[key] === 'number' && Number.isFinite(value[key])
    ? value[key]
    : undefined;
}

export function readEventError(
  value: Record<string, unknown> | null,
): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value.error === 'string') {
    return value.error;
  }
  if (isRecord(value.error) && typeof value.error.message === 'string') {
    return value.error.message;
  }
  return readEventString(value, 'message');
}

export function safeJson(value: string): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
