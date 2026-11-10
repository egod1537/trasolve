import { type ExternalApiUsageSummaryResponse } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import {
  Metric,
  number,
  latency,
  percent,
} from '@/pages/admin/AdminPrimitives';

export function serviceName(service: string): string {
  // Provider identifiers are technical product names, not translated status labels.
  const names: Record<string, string> = {
    'google-places': 'Google Places',
    'google-routes': 'Google Routes',
    gemini: 'Gemini',
    openwebui: 'OpenWebUI',
    troute: 'troute',
    tcache: 'tcache',
    'google-oauth': 'Google OAuth',
    'ssu-sso': 'Soongsil SSO',
  };
  return names[service] ?? service;
}

export function UsageMetrics({
  data,
}: {
  data: ExternalApiUsageSummaryResponse;
}) {
  const L = useL();
  return (
    <div className="admin-metrics">
      <Metric
        label={L('admin:usage.actualCalls')}
        value={number(data.totalActualCalls)}
        icon="exchange"
      />
      <Metric
        label={L('admin:usage.failureRate')}
        value={percent(data.failedCalls, data.totalActualCalls)}
        detail={L('admin:usage.failureCount', { count: data.failedCalls })}
        icon="error"
      />
      <Metric
        label={L('admin:usage.avgLatency')}
        value={latency(data.avgDurationMs)}
        icon="time"
      />
      <Metric
        label={L('admin:usage.p95Latency')}
        value={latency(data.p95DurationMs)}
        icon="dashboard"
      />
    </div>
  );
}

export function seoulDate(date: Date) {
  return new Date(date.valueOf() + 9 * 3600000).toISOString().slice(0, 10);
}
