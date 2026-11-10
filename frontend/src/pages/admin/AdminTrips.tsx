import { useCallback, useId, useState } from 'react';
import { fetchAdminTrips, fetchAdminTripMetadata } from '@/shared/api/admin';
import { useL } from '@/shared/i18n';
import { Dialog } from '@/shared/ui/Dialog';
import {
  Card,
  Badge,
  EmptyState,
  Pagination,
  ResourceState,
  dateTime,
  number,
} from './AdminPrimitives';
import { useAdminPagination, useAdminResource } from './useAdminResource';

export function AdminTrips() {
  const L = useL();
  const params = new URLSearchParams(window.location.search);
  const query = params.get('query') ?? '';
  const shared = params.get('shared') ?? '';
  const ownerUserId = params.get('ownerUserId') ?? '';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pagination = useAdminPagination();
  const cursor = pagination.cursor;
  const load = useCallback(() => {
    const search = new URLSearchParams({ query, limit: '25' });
    if (shared) {
      search.set('shared', shared);
    }
    if (ownerUserId) {
      search.set('ownerUserId', ownerUserId);
    }
    if (cursor) {
      search.set('cursor', cursor);
    }
    return fetchAdminTrips(search);
  }, [query, shared, ownerUserId, cursor]);
  const resource = useAdminResource(load);
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{L('admin:navigation.trips')}</h1>
          <p>{L('admin:trips.description')}</p>
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
      <Card>
        <form className="admin-toolbar" action="/admin/trips" method="get">
          <label className="admin-grow">
            {L('admin:common.search')}
            <input
              name="query"
              defaultValue={query}
              maxLength={100}
              placeholder={L('admin:trips.search.placeholder')}
            />
          </label>
          <label>
            {L('admin:trips.filter.owner')}
            <input
              name="ownerUserId"
              defaultValue={ownerUserId}
              placeholder={L('admin:usage.userId')}
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
            />
          </label>
          <label>
            {L('admin:trips.filter.shared')}
            <select name="shared" defaultValue={shared}>
              <option value="">{L('admin:common.all')}</option>
              <option value="true">{L('admin:trips.share.enabled')}</option>
              <option value="false">{L('admin:trips.share.disabled')}</option>
            </select>
          </label>
          <button className="admin-button admin-primary" type="submit">
            {L('admin:common.search')}
          </button>
          {(query || shared || ownerUserId) && (
            <a className="admin-button" href="/admin/trips">
              {L('admin:common.reset')}
            </a>
          )}
        </form>
        <ResourceState {...resource} retry={resource.reload} />
        {resource.data && (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{L('admin:trips.column.title')}</th>
                    <th>{L('admin:trips.filter.owner')}</th>
                    <th>{L('admin:trips.column.updatedAt')}</th>
                    <th>{L('admin:trips.column.dayCount')}</th>
                    <th>{L('admin:trips.column.placeCount')}</th>
                    <th>{L('admin:trips.filter.shared')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.trips.map((trip) => (
                    <tr key={trip.id}>
                      <td>
                        <button
                          className="admin-text-button admin-strong"
                          type="button"
                          onClick={() => setSelectedId(trip.id)}
                        >
                          {trip.title}
                        </button>
                        <small className="admin-cell-secondary">
                          {trip.id}
                        </small>
                      </td>
                      <td>
                        <a
                          href={`/admin/users?userId=${encodeURIComponent(trip.owner.id)}`}
                        >
                          {trip.owner.displayName || trip.owner.id}
                        </a>
                      </td>
                      <td>{dateTime(trip.updatedAt)}</td>
                      <td>{number(trip.dayCount)}</td>
                      <td>{number(trip.placeCount)}</td>
                      <td>
                        <Badge tone={trip.shareEnabled ? 'success' : 'neutral'}>
                          {trip.shareEnabled
                            ? L('admin:trips.share.enabled')
                            : L('admin:trips.share.disabled')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.trips.length && <EmptyState />}
            <Pagination
              page={pagination.page}
              total={resource.data.totalCount}
              hasNext={!!resource.data.nextCursor}
              loading={resource.loading}
              previous={pagination.previous}
              next={() => pagination.next(resource.data?.nextCursor)}
            />
          </>
        )}
      </Card>
      <p className="admin-notice">{L('admin:trips.metadataNote')}</p>
      {selectedId && (
        <TripDetail
          key={selectedId}
          tripId={selectedId}
          close={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function TripDetail({ tripId, close }: { tripId: string; close: () => void }) {
  const L = useL();
  const headingId = useId();
  const load = useCallback(() => fetchAdminTripMetadata(tripId), [tripId]);
  const resource = useAdminResource(load);
  const trip = resource.data?.trip;
  return (
    <Dialog className="admin-dialog" labelledBy={headingId} onClose={close}>
      <div className="admin-dialog-heading">
        <h2 id={headingId}>{L('admin:trips.detailTitle')}</h2>
        <button className="admin-button" type="button" onClick={close}>
          {L('common:action.close')}
        </button>
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {trip && (
        <>
          <h3>{trip.title}</h3>
          <dl className="admin-detail-grid">
            <dt>{L('admin:trips.id')}</dt>
            <dd>
              <code>{trip.id}</code>
            </dd>
            <dt>{L('admin:trips.filter.owner')}</dt>
            <dd>
              <a
                href={`/admin/users?userId=${encodeURIComponent(trip.owner.id)}`}
              >
                {trip.owner.displayName || trip.owner.id}
              </a>
            </dd>
            <dt>{L('admin:trips.column.createdAt')}</dt>
            <dd>{dateTime(trip.createdAt)}</dd>
            <dt>{L('admin:trips.column.updatedAt')}</dt>
            <dd>{dateTime(trip.updatedAt)}</dd>
            <dt>{L('admin:trips.column.dayCount')}</dt>
            <dd>{number(trip.dayCount)}</dd>
            <dt>{L('admin:trips.column.placeCount')}</dt>
            <dd>{number(trip.placeCount)}</dd>
            <dt>{L('admin:trips.dateRange')}</dt>
            <dd>
              {trip.startDate ?? '—'} / {trip.endDate ?? '—'}
            </dd>
            <dt>{L('admin:trips.filter.shared')}</dt>
            <dd>
              {trip.shareEnabled
                ? L('admin:trips.share.enabled')
                : L('admin:trips.share.disabled')}
            </dd>
            <dt>{L('admin:trips.searchable')}</dt>
            <dd>
              {trip.searchable ? L('admin:common.yes') : L('admin:common.no')}
            </dd>
            <dt>{L('admin:trips.revision')}</dt>
            <dd>{trip.revision}</dd>
            <dt>{L('admin:trips.schemaVersion')}</dt>
            <dd>{number(trip.schemaVersion)}</dd>
          </dl>
          <p className="admin-notice">{L('admin:trips.metadataNote')}</p>
        </>
      )}
    </Dialog>
  );
}
