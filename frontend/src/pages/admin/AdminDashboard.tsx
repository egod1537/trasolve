import { useCallback } from 'react';
import {
  fetchAdminSummary,
  fetchExternalApiUsage,
  fetchAdminOperations,
} from '@/shared/api/admin';
import { useL } from '@/shared/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Metric,
  Badge,
  ResourceState,
  EmptyState,
  number,
  dateTime,
  percent,
} from './AdminPrimitives';
import { UsageChart, serviceName } from './AdminUsage';
import { useAdminResource } from './useAdminResource';

export function AdminDashboard() {
  const L = useL();
  const loadSummary = useCallback(() => fetchAdminSummary(), []);
  const loadUsage = useCallback(
    () => fetchExternalApiUsage(new URLSearchParams()),
    [],
  );
  const loadOperations = useCallback(() => fetchAdminOperations(), []);
  const summary = useAdminResource(loadSummary);
  const usage = useAdminResource(loadUsage);
  const operations = useAdminResource(loadOperations);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{L('admin:navigation.dashboard')}</h1>
          <p>{L('admin:dashboard.description')}</p>
        </div>
        <button
          className="admin-button"
          type="button"
          disabled={summary.loading || usage.loading || operations.loading}
          onClick={() => {
            summary.reload();
            usage.reload();
            operations.reload();
          }}
        >
          {L('common:action.refresh')}
        </button>
      </div>
      <ResourceState {...summary} retry={summary.reload} />
      {summary.data && (
        <>
          <div className="admin-metrics">
            <Metric
              label={L('admin:dashboard.totalUsers')}
              value={number(summary.data.totalUsers)}
              icon="people"
            />
            <Metric
              label={L('admin:dashboard.activeUsers')}
              value={number(summary.data.activeUsers)}
              detail={L('admin:dashboard.activeNote')}
              icon="user"
            />
            <Metric
              label={L('admin:dashboard.recentLoginUsers')}
              value={number(summary.data.recentLoginUsers)}
              detail={L('admin:dashboard.loginNote')}
              icon="log-in"
            />
            <Metric
              label={L('admin:dashboard.totalTrips')}
              value={number(summary.data.totalTrips)}
              icon="map"
            />
          </div>
          <p className="admin-updated">
            {L('admin:common.generatedAt', {
              date: dateTime(summary.data.generatedAt),
            })}
          </p>
        </>
      )}
      <ResourceState {...usage} retry={usage.reload} />
      {usage.data && (
        <>
          <div className="admin-section-heading">
            <h2>{L('admin:dashboard.apiLastWeek')}</h2>
            <a href="/admin/api-usage">{L('admin:common.viewAll')}</a>
          </div>
          <div className="admin-metrics admin-metrics-three">
            <Metric
              label={L('admin:usage.actualCalls')}
              value={number(usage.data.totalActualCalls)}
              icon="exchange"
            />
            <Metric
              label={L('admin:usage.failedCalls')}
              value={number(usage.data.failedCalls)}
              icon="warning-sign"
            />
            <Metric
              label={L('admin:usage.failureRate')}
              value={percent(
                usage.data.failedCalls,
                usage.data.totalActualCalls,
              )}
              icon="chart"
            />
          </div>
          <UsageChart data={usage.data} />
        </>
      )}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{L('admin:navigation.operations')}</CardTitle>
            <CardDescription>
              {L('admin:operations.observationNote')}
            </CardDescription>
          </div>
          <a href="/admin/operations">{L('admin:common.viewAll')}</a>
        </CardHeader>
        <CardContent>
          <ResourceState {...operations} retry={operations.reload} />
          {operations.data && (
            <div className="admin-service-grid">
              {operations.data.services.map((service) => (
                <a
                  key={service.service}
                  className="admin-service-mini"
                  href="/admin/operations"
                >
                  <strong>{serviceName(service.service)}</strong>
                  <Badge tone={service.failedCalls ? 'danger' : 'neutral'}>
                    {service.failedCalls
                      ? L('admin:usage.failureCount', {
                          count: service.failedCalls,
                        })
                      : service.lastObservedAt
                        ? L('admin:operations.observed')
                        : L('admin:operations.noData')}
                  </Badge>
                </a>
              ))}
            </div>
          )}
          {operations.data && !operations.data.services.length && (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </>
  );
}
