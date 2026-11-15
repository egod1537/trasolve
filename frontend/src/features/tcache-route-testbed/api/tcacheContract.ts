import type { TcacheRouteJob } from '@/features/tcache-route-testbed/model/types';
import { L } from '@/shared/i18n';
import { captureUnexpectedApiException } from '@/shared/observability/sentry';

export function readStatus(value: unknown): TcacheRouteJob['status'] {
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
  throw tcacheContractViolation(
    'tcache.validate-job-status',
    L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred'),
  );
}

export function readCacheStatus(value: unknown): TcacheRouteJob['cacheStatus'] {
  if (value === 'hit' || value === 'HIT') {
    return 'hit';
  }
  if (value === 'miss' || value === 'MISS') {
    return 'miss';
  }
  if (value === 'unknown' || value === 'UNKNOWN') {
    return 'unknown';
  }
  return undefined;
}

export function readString(
  value: Record<string, unknown>,
  keys: string[],
): string {
  const result = readOptionalString(value, keys);
  if (result === undefined) {
    throw tcacheContractViolation(
      'tcache.validate-required-field',
      L('testbed:tcacheRouteTestbed.errorMessage.text.unknownErrorOccurred'),
    );
  }
  return result;
}

export function readOptionalString(
  value: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    if (typeof value[key] === 'string' && value[key].length > 0) {
      return value[key];
    }
  }
  return undefined;
}

export function readNumber(
  value: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  return readOptionalNumber(value, keys) ?? fallback;
}

export function readOptionalNumber(
  value: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
      return value[key];
    }
  }
  return undefined;
}

export function readTimestamp(
  value: Record<string, unknown>,
  keys: string[],
  fallback: number,
): number {
  return readOptionalTimestamp(value, keys) ?? fallback;
}

export function readOptionalTimestamp(
  value: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Date.parse(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function tcacheContractViolation(
  operation: string,
  message: string,
): Error {
  const error = new Error(message);
  captureUnexpectedApiException(error, { operation });
  return error;
}
