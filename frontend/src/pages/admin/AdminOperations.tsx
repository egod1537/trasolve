import { useCallback } from 'react';
import { fetchAdminOperations } from '@/shared/api/admin';
import { useL } from '@/shared/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  ResourceState,
  EmptyState,
  number,
  dateTime,
  latency,
  percent,
} from './AdminPrimitives';
import { serviceName } from './AdminUsage';
import { useAdminResource } from './useAdminResource';

export function AdminOperations() {
  const L = useL();
  const load = useCallback(() => fetchAdminOperations(), []);
  const resource = useAdminResource(load);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{L('admin:navigation.operations')}</h1>
          <p>{L('admin:operations.description')}</p>
        </div>
        <button
          className="admin-button"
          type="button"
          disabled={resource.loading}
          onClick={resource.reload}
        >
          {L('common:action.refresh')}
        </button>
      </div>
      <p className="admin-notice">{L('admin:operations.observationNote')}</p>
      <ResourceState {...resource} retry={resource.reload} />
      {resource.data && (
        <>
          <div className="admin-service-grid">
            {resource.data.services.map((service) => (
              <Card key={service.service}>
                <CardHeader>
                  <CardTitle>{serviceName(service.service)}</CardTitle>
                  <Badge
                    tone={service.configured === false ? 'warning' : 'neutral'}
                  >
                    {service.configured === null
                      ? L('admin:operations.unknown')
                      : service.configured
                        ? L('admin:operations.configured')
                        : L('admin:operations.notConfigured')}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <dl className="admin-service-stats">
                    <dt>{L('admin:usage.actualCalls')}</dt>
                    <dd>{number(service.actualCalls)}</dd>
                    <dt>{L('admin:usage.failedCalls')}</dt>
                    <dd className={service.failedCalls ? 'admin-error' : ''}>
                      {number(service.failedCalls)}
                    </dd>
                    <dt>{L('admin:usage.failureRate')}</dt>
                    <dd>{percent(service.failedCalls, service.actualCalls)}</dd>
                    <dt>{L('admin:usage.avgLatency')}</dt>
                    <dd>{latency(service.avgDurationMs)}</dd>
                    <dt>{L('admin:operations.lastObservedAt')}</dt>
                    <dd>{dateTime(service.lastObservedAt)}</dd>
                  </dl>
                  <div className="admin-service-errors">
                    <span className="admin-muted">
                      {L('admin:operations.recentErrors')}
                    </span>
                    {service.recentErrorCodes.length ? (
                      service.recentErrorCodes.map((code) => (
                        <code key={code}>{code}</code>
                      ))
                    ) : (
                      <span>{L('admin:operations.noObservedErrors')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{L('admin:operations.jobs')}</CardTitle>
            </CardHeader>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{L('admin:usage.service')}</th>
                    <th>{L('admin:operations.observation')}</th>
                    <th>{L('admin:operations.observedJobs')}</th>
                    <th>{L('admin:operations.runningJobs')}</th>
                    <th>{L('admin:operations.failedJobs')}</th>
                    <th>{L('admin:operations.lastUpdated')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.jobMirrors.map((job) => (
                    <tr key={job.service}>
                      <td className="admin-strong">
                        {serviceName(job.service)}
                      </td>
                      <td>
                        <Badge tone={job.available ? 'neutral' : 'warning'}>
                          {job.available
                            ? L('admin:operations.available')
                            : L('admin:operations.unavailable')}
                        </Badge>
                      </td>
                      <td>{job.available ? number(job.observedJobs) : '—'}</td>
                      <td>{job.available ? number(job.runningJobs) : '—'}</td>
                      <td>{job.available ? number(job.failedJobs) : '—'}</td>
                      <td>{dateTime(job.lastUpdatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.jobMirrors.length && <EmptyState />}
          </Card>
          <p className="admin-notice">{L('admin:operations.jobsNote')}</p>
          <p className="admin-updated">
            {L('admin:operations.window', {
              from: dateTime(resource.data.from),
              to: dateTime(resource.data.to),
            })}
          </p>
        </>
      )}
    </>
  );
}
