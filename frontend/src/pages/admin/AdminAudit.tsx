import { useCallback } from 'react';
import { fetchAdminAudit } from '@/shared/api/admin';
import { useL } from '@/shared/i18n';
import {
  Card,
  Badge,
  ResourceState,
  EmptyState,
  Pagination,
  dateTime,
} from './AdminPrimitives';
import { useAdminPagination, useAdminResource } from './useAdminResource';

export function AdminAudit() {
  const L = useL();
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action') ?? '';
  const actorUserId = params.get('actorUserId') ?? '';
  const pagination = useAdminPagination();
  const cursor = pagination.cursor;
  const load = useCallback(() => {
    const search = new URLSearchParams({ limit: '25' });
    if (action) {
      search.set('action', action);
    }
    if (actorUserId) {
      search.set('actorUserId', actorUserId);
    }
    if (cursor) {
      search.set('cursor', cursor);
    }
    return fetchAdminAudit(search);
  }, [action, actorUserId, cursor]);
  const resource = useAdminResource(load);
  const label = (code: string) => {
    if (code === 'user.suspend') {
      return L('admin:users.action.suspend');
    }
    if (code === 'user.restore') {
      return L('admin:users.action.restore');
    }
    if (code === 'user.revoke-sessions') {
      return L('admin:users.action.revokeSessions');
    }
    return code;
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{L('admin:navigation.audit')}</h1>
          <p>{L('admin:audit.description')}</p>
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
        <form className="admin-toolbar" action="/admin/audit" method="get">
          <label>
            {L('admin:audit.filter.action')}
            <select name="action" defaultValue={action}>
              <option value="">{L('admin:common.all')}</option>
              <option value="user.suspend">
                {L('admin:users.action.suspend')}
              </option>
              <option value="user.restore">
                {L('admin:users.action.restore')}
              </option>
              <option value="user.revoke-sessions">
                {L('admin:users.action.revokeSessions')}
              </option>
            </select>
          </label>
          <label className="admin-grow">
            {L('admin:audit.filter.actor')}
            <input
              name="actorUserId"
              defaultValue={actorUserId}
              placeholder={L('admin:usage.userId')}
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
            />
          </label>
          <button className="admin-button admin-primary" type="submit">
            {L('common:action.apply')}
          </button>
          {(action || actorUserId) && (
            <a className="admin-button" href="/admin/audit">
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
                    <th>{L('admin:audit.column.time')}</th>
                    <th>{L('admin:audit.filter.actor')}</th>
                    <th>{L('admin:audit.filter.action')}</th>
                    <th>{L('admin:audit.column.target')}</th>
                    <th>{L('admin:common.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.events.map((event) => (
                    <tr key={event.id}>
                      <td>{dateTime(event.time)}</td>
                      <td>
                        <a
                          href={`/admin/users?userId=${encodeURIComponent(event.actor.id)}`}
                        >
                          {event.actor.displayName || event.actor.id}
                        </a>
                      </td>
                      <td>
                        <Badge>{label(event.action)}</Badge>
                      </td>
                      <td>
                        {event.targetType === 'user' ? (
                          <a
                            href={`/admin/users?userId=${encodeURIComponent(event.targetId)}`}
                          >
                            {event.targetId}
                          </a>
                        ) : (
                          <code>{event.targetId}</code>
                        )}
                      </td>
                      <td>
                        <details>
                          <summary>{L('admin:common.details')}</summary>
                          <pre className="admin-audit-metadata">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                          <small className="admin-cell-secondary">
                            {event.id}
                          </small>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.events.length && <EmptyState />}
            <Pagination
              page={pagination.page}
              hasNext={!!resource.data.nextCursor}
              loading={resource.loading}
              previous={pagination.previous}
              next={() => pagination.next(resource.data?.nextCursor)}
            />
          </>
        )}
      </Card>
    </>
  );
}
