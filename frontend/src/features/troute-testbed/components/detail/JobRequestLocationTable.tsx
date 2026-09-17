import { Classes } from '@blueprintjs/core';
import type { TrouteOptimizeRequest } from '@trasolve/shared';

interface JobRequestLocationTableProps {
  locations: TrouteOptimizeRequest['locations'];
}

export function JobRequestLocationTable({
  locations,
}: JobRequestLocationTableProps) {
  return (
    <div className="table-scroll job-request-location-table-scroll">
      <table
        className={`${Classes.HTML_TABLE} ${Classes.HTML_TABLE_BORDERED} ${Classes.HTML_TABLE_STRIPED} job-request-location-table`}
      >
        <thead>
          <tr>
            <th>입력 순서</th>
            <th>위치 ID</th>
            <th>Place ID</th>
            <th>역할</th>
            <th>영업시간</th>
            <th>체류</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location, index) => (
            <tr key={`${index}:${location.id}`}>
              <td>{index}</td>
              <td className={`${Classes.MONOSPACE_TEXT} job-request-id-cell`}>
                <span title={location.id}>{location.id}</span>
              </td>
              <td
                className={`${Classes.MONOSPACE_TEXT} job-request-place-id-cell`}
              >
                <span title={location.place_id}>{location.place_id}</span>
              </td>
              <td>{getLocationRoleLabel(index, locations.length)}</td>
              <td>
                {location.open_time}~{location.close_time}
              </td>
              <td>{location.stay_minutes}분</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getLocationRoleLabel(index: number, total: number): string {
  if (index === 0) {
    return '출발지';
  }
  if (index === total - 1) {
    return '도착지';
  }
  return '경유지';
}
