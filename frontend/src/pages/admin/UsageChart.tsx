import { type ExternalApiUsageSummaryResponse } from '@trasolve/shared';
import { useL, getLanguage } from '@/shared/i18n';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  EmptyState,
  number,
} from '@/pages/admin/AdminPrimitives';

export function UsageChart({
  data,
}: {
  data: ExternalApiUsageSummaryResponse;
}) {
  const L = useL();
  const hour = data.bucket === 'hour';
  const step = (hour ? 1 : 24) * 3600000;
  const offset = 9 * 3600000;
  const first =
    Math.floor((Date.parse(data.from) + offset) / step) * step - offset;
  const values = new Map(
    data.byBucket.map((bucket) => [Date.parse(bucket.start), bucket]),
  );
  const buckets = [];
  for (let start = first; start < Date.parse(data.to); start += step) {
    const bucket = values.get(start);
    buckets.push({
      start,
      calls: bucket?.actualCalls ?? 0,
      failed: bucket?.failedCalls ?? 0,
    });
  }
  const max = Math.max(1, ...buckets.map((bucket) => bucket.calls));
  const format = new Intl.DateTimeFormat(getLanguage(), {
    timeZone: 'Asia/Seoul',
    month: 'short',
    day: 'numeric',
    ...(hour ? ({ hour: 'numeric' } as const) : {}),
  });
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{L('admin:usage.trend')}</CardTitle>
          <CardDescription>{L('admin:usage.trendDescription')}</CardDescription>
        </div>
        <div className="admin-chart-legend">
          <span>
            <i />
            {L('admin:usage.actualCalls')}
          </span>
          <span>
            <i className="admin-chart-failed" />
            {L('admin:usage.failedCalls')}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {!data.hasCollectedData ? (
          <EmptyState />
        ) : (
          <>
            <div
              className="admin-chart"
              role="img"
              aria-label={L('admin:usage.trendSummary', {
                calls: number(data.totalActualCalls),
                failed: number(data.failedCalls),
              })}
            >
              <div className="admin-chart-axis">
                <span>{number(max)}</span>
                <span>{number(0)}</span>
              </div>
              <div className="admin-chart-bars">
                {buckets.map((bucket) => (
                  <div
                    key={bucket.start}
                    className="admin-chart-column"
                    title={L('admin:usage.bucketSummary', {
                      date: format.format(bucket.start),
                      calls: number(bucket.calls),
                      failed: number(bucket.failed),
                    })}
                  >
                    <div
                      className="admin-chart-bar"
                      style={{ height: `${(bucket.calls / max) * 100}%` }}
                    >
                      <div
                        className="admin-chart-failed"
                        style={{
                          height: `${bucket.calls ? (bucket.failed / bucket.calls) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-chart-labels">
              <span>{format.format(Date.parse(data.from))}</span>
              <span>{format.format(Date.parse(data.to) - 1)}</span>
            </div>
            <details className="admin-chart-data">
              <summary>{L('admin:usage.viewChartData')}</summary>
              <div className="admin-table-scroll">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{L('admin:audit.column.time')}</th>
                      <th>{L('admin:usage.actualCalls')}</th>
                      <th>{L('admin:usage.failedCalls')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((bucket) => (
                      <tr key={bucket.start}>
                        <td>{format.format(bucket.start)}</td>
                        <td>{number(bucket.calls)}</td>
                        <td>{number(bucket.failed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
