import { Classes } from '@blueprintjs/core';
import type { TrouteOptimizeResponse } from '@trasolve/shared';

export function JobResultSummary({
  optimization,
}: {
  optimization: TrouteOptimizeResponse;
}) {
  return (
    <section className="route-summary" aria-labelledby="route-title">
      <div className="route-overview">
        <div>
          <h2 id="route-title" className={Classes.HEADING}>
            경로
          </h2>
          <div aria-label="방문 순서">
            {optimization.route.map((stop) => stop.location_id).join(' → ')}
          </div>
        </div>
        <div>
          <span className={Classes.TEXT_MUTED}>총 이동 시간</span>
          <strong>{optimization.total_travel_minutes}분</strong>
        </div>
      </div>
      <div className="table-scroll">
        <table
          className={`${Classes.HTML_TABLE} ${Classes.HTML_TABLE_BORDERED} ${Classes.HTML_TABLE_STRIPED}`}
        >
          <thead>
            <tr>
              <th>순서</th>
              <th>위치</th>
              <th>도착</th>
              <th>출발</th>
            </tr>
          </thead>
          <tbody>
            {optimization.route.map((stop, index) => (
              <tr key={`${stop.order}-${stop.location_id}-${index}`}>
                <td>{stop.order}</td>
                <td>{stop.location_id}</td>
                <td>{stop.arrival_time}</td>
                <td>{stop.departure_time ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
