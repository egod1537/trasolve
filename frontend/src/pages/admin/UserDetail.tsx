import { useCallback, useId, useState } from 'react';
import type { AdminMeResponse } from '@trasolve/shared';
import {
  fetchAdminMe,
  fetchAdminUser,
  mutateAdminUser,
  AdminApiError,
} from '@/shared/api/admin';
import { useL } from '@/shared/i18n';
import { Dialog } from '@/shared/ui/Dialog';
import {
  Card,
  CardHeader,
  CardTitle,
  ResourceState,
  number,
  dateTime,
} from '@/pages/admin/AdminPrimitives';
import { useAdminResource } from '@/pages/admin/useAdminResource';
import {
  type UserAction,
  UserState,
} from '@/pages/admin/userStatePresentation';

export function UserDetail({
  userId,
  session,
  close,
  changed,
}: {
  userId: string;
  session: AdminMeResponse;
  close: () => void;
  changed: () => void;
}) {
  const L = useL();
  const headingId = useId();
  const confirmationId = useId();
  const load = useCallback(() => fetchAdminUser(userId), [userId]);
  const resource = useAdminResource(load);
  const [action, setAction] = useState<UserAction | null>(null);
  const [reason, setReason] = useState<'abuse' | 'request' | 'other'>('other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const user = resource.data?.user;
  const actionLabel =
    action === 'suspend'
      ? L('admin:users.action.suspend')
      : action === 'restore'
        ? L('admin:users.action.restore')
        : L('admin:users.action.revokeSessions');
  const confirmLabel =
    action === 'suspend'
      ? L('admin:users.confirm.suspend')
      : action === 'restore'
        ? L('admin:users.confirm.restore')
        : L('admin:users.confirm.revokeSessions');
  const mutate = async () => {
    if (!action || busy || userId === session.user.id) {
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // Refresh a potentially expired CSRF token and verify the actor has not changed.
      const current = await fetchAdminMe();
      if (current.user.id !== session.user.id) {
        throw new AdminApiError(403, 'ADMIN_ACTOR_CHANGED');
      }
      const result = await mutateAdminUser(
        userId,
        action,
        current.csrfToken,
        action === 'suspend' ? { reasonCode: reason } : {},
      );
      setSuccess(
        L('admin:users.actionSuccess', { count: result.revokedSessionCount }),
      );
      setAction(null);
      resource.reload();
      changed();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      className="admin-dialog"
      labelledBy={headingId}
      onClose={close}
      busy={busy}
    >
      <div className="admin-dialog-heading">
        <h2 id={headingId}>{L('admin:users.detailTitle')}</h2>
        <button
          className="admin-button"
          type="button"
          onClick={close}
          disabled={busy}
        >
          {L('common:action.close')}
        </button>
      </div>
      <ResourceState {...resource} retry={resource.reload} />
      {user && (
        <>
          <div className="admin-profile">
            <span className="admin-avatar admin-avatar-large">
              {(user.displayName || user.email || user.id)
                .slice(0, 1)
                .toLocaleUpperCase()}
            </span>
            <div>
              <h3>{user.displayName || L('admin:users.unnamed')}</h3>
              <p>{user.email ?? '—'}</p>
              <UserState user={user} />
            </div>
          </div>
          <dl className="admin-detail-grid">
            <dt>{L('admin:usage.userId')}</dt>
            <dd>
              <code>{user.id}</code>
            </dd>
            <dt>{L('admin:users.filter.role')}</dt>
            <dd>
              {user.role === 'admin'
                ? L('admin:users.role.admin')
                : L('admin:users.role.user')}
            </dd>
            <dt>{L('admin:users.column.createdAt')}</dt>
            <dd>{dateTime(user.createdAt)}</dd>
            <dt>{L('admin:users.column.lastLoginAt')}</dt>
            <dd>{dateTime(user.lastLoginAt)}</dd>
            <dt>{L('admin:users.emailVerified')}</dt>
            <dd>
              {user.emailVerified
                ? L('admin:common.yes')
                : L('admin:common.no')}
            </dd>
            <dt>{L('admin:users.column.tripCount')}</dt>
            <dd>{number(user.tripCount)}</dd>
          </dl>
          <div className="admin-inline admin-detail-links">
            <a
              className="admin-button"
              href={`/admin/trips?ownerUserId=${encodeURIComponent(user.id)}`}
            >
              {L('admin:navigation.trips')}
            </a>
            <a
              className="admin-button"
              href={`/admin/api-usage?actorUserId=${encodeURIComponent(user.id)}`}
            >
              {L('admin:navigation.apiUsage')}
            </a>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{L('admin:users.identities')}</CardTitle>
            </CardHeader>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{L('admin:users.identityIssuer')}</th>
                    <th>{L('admin:users.column.email')}</th>
                    <th>{L('admin:users.column.lastLoginAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data?.identities.map((identity) => (
                    <tr key={`${identity.issuer}:${identity.subjectHint}`}>
                      <td>
                        <code>{identity.issuer}</code>
                        <small className="admin-cell-secondary">
                          {identity.subjectHint}
                        </small>
                      </td>
                      <td>{identity.emailHint ?? '—'}</td>
                      <td>{dateTime(identity.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <section className="admin-account-actions">
            <h3>{L('admin:users.actionsTitle')}</h3>
            {user.id === session.user.id ? (
              <p className="admin-muted">{L('admin:users.selfActionNote')}</p>
            ) : (
              <div className="admin-inline">
                <button
                  className={`admin-button ${user.state === 'active' ? 'admin-danger' : ''}`}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAction(user.state === 'active' ? 'suspend' : 'restore');
                  }}
                >
                  {user.state === 'active'
                    ? L('admin:users.action.suspend')
                    : L('admin:users.action.restore')}
                </button>
                <button
                  className="admin-button"
                  type="button"
                  onClick={() => {
                    setError(null);
                    setAction('revoke-sessions');
                  }}
                >
                  {L('admin:users.action.revokeSessions')}
                </button>
              </div>
            )}
          </section>
        </>
      )}
      {success && (
        <p role="status" className="admin-success">
          {success}
        </p>
      )}
      {action && (
        <Dialog
          className="admin-dialog admin-confirm-dialog"
          role="alertdialog"
          labelledBy={confirmationId}
          busy={busy}
          onClose={() => setAction(null)}
        >
          <h2 id={confirmationId}>{actionLabel}</h2>
          <p>{confirmLabel}</p>
          <p className="admin-strong">
            {user?.displayName || user?.email || userId}
          </p>
          {action === 'suspend' && (
            <label className="admin-field">
              {L('admin:users.reason')}
              <select
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value as typeof reason)
                }
                disabled={busy}
              >
                <option value="abuse">{L('admin:users.reasonAbuse')}</option>
                <option value="request">
                  {L('admin:users.reasonRequest')}
                </option>
                <option value="other">{L('admin:users.reasonOther')}</option>
              </select>
            </label>
          )}
          {!!error && (
            <ResourceState
              loading={false}
              error={error}
              retry={() => void mutate()}
            />
          )}
          <div className="admin-dialog-actions">
            <button
              className="admin-button"
              type="button"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              {L('common:action.cancel')}
            </button>
            <button
              className={`admin-button ${action === 'restore' ? 'admin-primary' : 'admin-danger'}`}
              type="button"
              disabled={busy}
              onClick={() => void mutate()}
            >
              {busy
                ? L('admin:common.processing')
                : L('admin:common.action.confirm')}
            </button>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
