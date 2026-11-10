import { useCallback, useState } from 'react';
import type { AdminMeResponse } from '@trasolve/shared';
import { fetchAdminUsers } from '@/shared/api/admin';
import { useL } from '@/shared/i18n';
import {
  Card,
  Badge,
  Pagination,
  EmptyState,
  ResourceState,
  number,
  dateTime,
} from '@/pages/admin/AdminPrimitives';
import {
  useAdminPagination,
  useAdminResource,
} from '@/pages/admin/useAdminResource';
import { UserState } from '@/pages/admin/userStatePresentation';
import { UserDetail } from '@/pages/admin/UserDetail';
export { UserState } from '@/pages/admin/userStatePresentation';

export function AdminUsers({ session }: { session: AdminMeResponse }) {
  const L = useL();
  const params = new URLSearchParams(window.location.search);
  const query = params.get('query') ?? '';
  const role = params.get('role') ?? '';
  const state = params.get('state') ?? '';
  const [selectedId, setSelectedId] = useState<string | null>(
    params.get('userId'),
  );
  const pagination = useAdminPagination();
  const cursor = pagination.cursor;
  const load = useCallback(() => {
    const search = new URLSearchParams({ query, limit: '25' });
    if (role) {
      search.set('role', role);
    }
    if (state) {
      search.set('state', state);
    }
    if (cursor) {
      search.set('cursor', cursor);
    }
    return fetchAdminUsers(search);
  }, [query, role, state, cursor]);
  const resource = useAdminResource(load);
  const closeDetail = () => {
    setSelectedId(null);
    const search = new URLSearchParams(window.location.search);
    search.delete('userId');
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${search.size ? `?${search}` : ''}`,
    );
  };
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <h1>{L('admin:navigation.users')}</h1>
          <p>{L('admin:users.description')}</p>
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
      <Card>
        <form className="admin-toolbar" action="/admin/users" method="get">
          <label className="admin-grow">
            {L('admin:common.search')}
            <input
              name="query"
              defaultValue={query}
              maxLength={100}
              placeholder={L('admin:users.search.placeholder')}
            />
          </label>
          <label>
            {L('admin:users.filter.role')}
            <select name="role" defaultValue={role}>
              <option value="">{L('admin:common.all')}</option>
              <option value="user">{L('admin:users.role.user')}</option>
              <option value="admin">{L('admin:users.role.admin')}</option>
            </select>
          </label>
          <label>
            {L('admin:users.filter.state')}
            <select name="state" defaultValue={state}>
              <option value="">{L('admin:common.all')}</option>
              <option value="active">{L('admin:users.state.active')}</option>
              <option value="suspended">
                {L('admin:users.state.suspended')}
              </option>
            </select>
          </label>
          <button className="admin-button admin-primary" type="submit">
            {L('admin:common.search')}
          </button>
          {(query || role || state) && (
            <a className="admin-button" href="/admin/users">
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
                    <th>{L('admin:users.column.name')}</th>
                    <th>{L('admin:users.column.email')}</th>
                    <th>{L('admin:users.filter.role')}</th>
                    <th>{L('admin:users.filter.state')}</th>
                    <th>{L('admin:users.column.createdAt')}</th>
                    <th>{L('admin:users.column.lastLoginAt')}</th>
                    <th>{L('admin:users.column.tripCount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <button
                          className="admin-user-link"
                          type="button"
                          onClick={() => setSelectedId(user.id)}
                        >
                          <span className="admin-avatar">
                            {(user.displayName || user.email || user.id)
                              .slice(0, 1)
                              .toLocaleUpperCase()}
                          </span>
                          <span>
                            {user.displayName || L('admin:users.unnamed')}
                            <small className="admin-cell-secondary">
                              {user.id.slice(0, 8)}
                            </small>
                          </span>
                        </button>
                      </td>
                      <td>{user.email ?? '—'}</td>
                      <td>
                        <Badge>
                          {user.role === 'admin'
                            ? L('admin:users.role.admin')
                            : L('admin:users.role.user')}
                        </Badge>
                      </td>
                      <td>
                        <UserState user={user} />
                      </td>
                      <td>{dateTime(user.createdAt)}</td>
                      <td>{dateTime(user.lastLoginAt)}</td>
                      <td>{number(user.tripCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!resource.data.users.length && <EmptyState />}
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
      {selectedId && (
        <UserDetail
          key={selectedId}
          userId={selectedId}
          session={session}
          close={closeDetail}
          changed={() => {
            pagination.reset();
            resource.reload();
          }}
        />
      )}
    </>
  );
}
