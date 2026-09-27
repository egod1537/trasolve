import { Classes } from '@blueprintjs/core';
import type { TrouteOptimizeRequest } from '@trasolve/shared';
import { useL, L } from '@/shared/i18n';

interface JobRequestLocationTableProps {
  locations: TrouteOptimizeRequest['locations'];
}

export function JobRequestLocationTable({
  locations,
}: JobRequestLocationTableProps) {
  const L = useL();
  return (
    <div className="table-scroll job-request-location-table-scroll">
      <table
        className={`${Classes.HTML_TABLE} ${Classes.HTML_TABLE_BORDERED} ${Classes.HTML_TABLE_STRIPED} job-request-location-table`}
      >
        <thead>
          <tr>
            <th>{L('testbed:jobRequestLocationTable.text.inputOrder')}</th>
            <th>{L('testbed:jobRequestLocationTable.text.locationId')}</th>
            <th>{L('testbed:jobDetail.requestSection.text.placeId')}</th>
            <th>{L('testbed:jobDetail.requestSection.text.role')}</th>
            <th>{L('testbed:jobRequestLocationTable.text.businessHours')}</th>
            <th>{L('testbed:jobRequestLocationTable.text.stay')}</th>
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
              <td>
                {L('testbed:jobRequestLocationTable.text.minutes2', {
                  stay_minutes: location.stay_minutes,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getLocationRoleLabel(index: number, total: number): string {
  if (index === 0) {
    return L('testbed:jobResultMapComparison.locationSequence.label.departure');
  }
  if (index === total - 1) {
    return L('testbed:jobResultMapComparison.locationSequence.label.arrival');
  }
  return L('testbed:viewModel.getTcacheRouteLocationRole.text.stopover');
}
