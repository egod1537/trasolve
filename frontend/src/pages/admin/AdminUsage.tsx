import { useCallback, useState, type FormEvent } from 'react';
import { externalApiServiceSchema } from '@trasolve/shared';
import { fetchExternalApiUsage } from '@/shared/api/admin';
import { useL, NL } from '@/shared/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  EmptyState,
  ResourceState,
  number,
  dateTime,
  latency,
  percent,
} from '@/pages/admin/AdminPrimitives';
import { useAdminResource } from '@/pages/admin/useAdminResource';
import {
  serviceName,
  UsageMetrics,
  seoulDate,
} from '@/pages/admin/usagePresentation';
import { UsageChart } from '@/pages/admin/UsageChart';
export { serviceName, UsageMetrics } from '@/pages/admin/usagePresentation';
export { UsageChart } from '@/pages/admin/UsageChart';

export function AdminUsage() {
  const L = useL();
  const search = new URLSearchParams(window.location.search);
  const [now] = useState(() => Date.now());
  const today = seoulDate(new Date(now));
  const weekAgo = seoulDate(new Date(now - 6 * 86400000));
  const fromDay = search.get('from') ?? weekAgo;
  const toDay = search.get('to') ?? today;
  const actorUserId = search.get('actorUserId') ?? '';
  const service = search.get('service') ?? '';
  const from = new Date(`${fromDay}T00:00:00+09:00`);
  const to = new Date(new Date(`${toDay}T00:00:00+09:00`).valueOf() + 86400000);
  const range = to.valueOf() - from.valueOf();
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(fromDay) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toDay) &&
    Number.isFinite(range) &&
    seoulDate(from) === fromDay &&
    seoulDate(new Date(to.valueOf() - 86400000)) === toDay &&
    range > 0 &&
    range <= 90 * 86400000 &&
    (!actorUserId ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        actorUserId,
      )) &&
    (!service || externalApiServiceSchema.safeParse(service).success);
  const fromIso = valid ? from.toISOString() : '';
  const toIso = valid ? to.toISOString() : '';
  const load = useCallback(() => {
    if (!valid) {
      return Promise.reject(new Error('INVALID_USAGE_FILTERS'));
    }
    const params = new URLSearchParams({
      from: fromIso,
      to: toIso,
      bucket: range <= 2 * 86400000 ? 'hour' : 'day',
    });
    if (actorUserId) {
      params.set('actorUserId', actorUserId);
    }
    if (service) {
      params.set('service', service);
    }
    return fetchExternalApiUsage(params);
  }, [valid, fromIso, toIso, range, actorUserId, service]);
  const resource = useAdminResource(load);
  const validate = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const fields = new FormData(form);
    const duration =
      Date.parse(`${fields.get('to')}T00:00:00+09:00`) -
      Date.parse(`${fields.get('from')}T00:00:00+09:00`);
    const input = form.elements.namedItem('to') as HTMLInputElement;
    input.setCustomValidity(
      !Number.isFinite(duration) || duration < 0 || duration >= 90 * 86400000
        ? L('admin:usage.invalidRange')
        : '',
    );
    if (!form.reportValidity()) {
      event.preventDefault();
    }
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{L('admin:navigation.apiUsage')}</h1>
          <p>{L('admin:usage.description')}</p>
        </div>
        <button
          className="admin-button"
          type="button"
          onClick={resource.reload}
          disabled={resource.loading}
        >
          {L('common:action.refresh')}
        </button>
      </div>
      <form
        className="admin-toolbar"
        action="/admin/api-usage"
        method="get"
        onSubmit={validate}
        onChange={(event) => {
          const input = event.currentTarget.elements.namedItem(
            'to',
          ) as HTMLInputElement;
          input.setCustomValidity('');
        }}
      >
        <label>
          {L('admin:common.from')}
          <input name="from" type="date" required defaultValue={fromDay} />
        </label>
        <label>
          {L('admin:common.to')}
          <input name="to" type="date" required defaultValue={toDay} />
        </label>
        <label>
          {L('admin:usage.service')}
          <select name="service" defaultValue={service}>
            <option value="">{L('admin:common.all')}</option>
            {externalApiServiceSchema.options.map((value) => (
              <option key={value} value={value}>
                {serviceName(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-grow">
          {L('admin:usage.userId')}
          <input
            name="actorUserId"
            defaultValue={actorUserId}
            placeholder={L('admin:usage.userIdPlaceholder')}
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
          />
        </label>
        <button className="admin-button admin-primary" type="submit">
          {L('common:action.apply')}
        </button>
        {window.location.search && (
          <a className="admin-button" href="/admin/api-usage">
            {L('admin:common.reset')}
          </a>
        )}
      </form>
      {!valid ? (
        <p className="admin-notice admin-error" role="alert">
          {L('admin:usage.invalidFilters')}
        </p>
      ) : (
        <ResourceState {...resource} retry={resource.reload} />
      )}
      {resource.data && (
        <>
          <UsageMetrics data={resource.data} />
          <UsageChart data={resource.data} />
          <Card>
            <CardHeader>
              <CardTitle>{L('admin:usage.byService')}</CardTitle>
            </CardHeader>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{L('admin:usage.service')}</th>
                    <th>{L('admin:usage.actualCalls')}</th>
                    <th>{L('admin:usage.failureRate')}</th>
                    <th>{L('admin:usage.avgLatency')}</th>
                    <th>{L('admin:usage.p95Latency')}</th>
                    <th>{L('admin:usage.blockedCalls')}</th>
                    <th>{L('admin:usage.mockCalls')}</th>
                    <th>{L('admin:operations.lastObservedAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.byService.map((row) => (
                    <tr key={row.service}>
                      <td className="admin-strong">
                        {serviceName(row.service)}
                      </td>
                      <td>{number(row.actualCalls)}</td>
                      <td>{percent(row.failedCalls, row.actualCalls)}</td>
                      <td>{latency(row.avgDurationMs)}</td>
                      <td>{latency(row.p95DurationMs)}</td>
                      <td>{number(row.blockedCalls)}</td>
                      <td>{number(row.mockCalls)}</td>
                      <td>{dateTime(row.lastObservedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.byService.length && <EmptyState />}
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{L('admin:usage.byUser')}</CardTitle>
              <CardDescription>{L('admin:usage.topUsersNote')}</CardDescription>
            </CardHeader>
            {resource.data.perUserTop.length ? (
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{L('admin:navigation.users')}</th>
                      <th>{L('admin:usage.actualCalls')}</th>
                      <th>{L('admin:common.details')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.perUserTop.map((row) => (
                      <tr key={row.userId}>
                        <td>
                          <a
                            href={`/admin/users?userId=${encodeURIComponent(row.userId)}`}
                          >
                            {row.displayName || row.userId}
                          </a>
                          <small className="admin-cell-secondary">
                            {row.userId}
                          </small>
                        </td>
                        <td>{number(row.actualCalls)}</td>
                        <td>
                          <a
                            href={`/admin/api-usage?${new URLSearchParams({ from: fromDay, to: toDay, actorUserId: row.userId, ...(service ? { service } : {}) })}`}
                          >
                            {L('admin:navigation.apiUsage')}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState />
            )}
          </Card>
          <p className="admin-notice">
            {L('admin:usage.coverage')} {L('admin:usage.noCost')}{' '}
            {NL('Asia/Seoul')}
          </p>
        </>
      )}
    </>
  );
}
