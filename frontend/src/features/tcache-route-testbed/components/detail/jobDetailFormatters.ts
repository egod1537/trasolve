import type {
  TcacheRouteJob,
  TcacheStreamState,
} from '@/features/tcache-route-testbed/model/types';
import { getLanguage, L, NL } from '@/shared/i18n';

export function formatStreamState(state: TcacheStreamState): string {
  if (state === 'connected') {
    return L('testbed:jobDetail.formatStreamState.text.connected');
  }
  if (state === 'connecting') {
    return L('testbed:jobDetail.formatStreamState.text.connecting');
  }
  if (state === 'retrying') {
    return L('testbed:jobDetail.formatStreamState.text.reconnecting');
  }
  if (state === 'disconnected') {
    return L('testbed:jobDetail.formatStreamState.text.connectionLost');
  }
  return L('testbed:jobDetail.formatStreamState.text.waiting');
}

export function formatCache(value: TcacheRouteJob['cacheStatus']): string {
  return value ? value.toUpperCase() : '-';
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(getLanguage());
}

export function formatDistance(value?: number): string {
  if (value === undefined) {
    return '-';
  }
  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}${NL('km')}`
    : `${value}${NL('m')}`;
}

export function formatDuration(value?: number): string {
  if (value === undefined) {
    return '-';
  }
  return value >= 3_600
    ? L('testbed:jobDetail.formatDuration.text.hoursMinutes', {
        floor: Math.floor(value / 3_600),
        round: Math.round((value % 3_600) / 60),
      })
    : L('testbed:jobDetail.formatDuration.text.minutes', {
        round: Math.round(value / 60),
      });
}

export function formatLocation(
  location: TcacheRouteJob['request']['locations'][number],
): string {
  if (location.lat !== undefined && location.lng !== undefined) {
    return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
  }
  return location.address ?? '-';
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
