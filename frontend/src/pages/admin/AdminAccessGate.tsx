import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AdminMeResponse } from '@trasolve/shared';
import {
  consumeGoogleOAuthResult,
  loginAsDebugGuest,
  startGoogleOAuth,
} from '@/features/auth';
import { useL } from '@/shared/i18n';
import { AdminApiError, fetchAdminMe } from '@/shared/api/admin';

type AccessState =
  | { status: 'loading' }
  | { status: 'granted'; session: AdminMeResponse }
  | { status: 'signed-out' }
  | { status: 'forbidden' }
  | { status: 'unavailable'; code: string };

export function AdminAccessGate({
  children,
}: {
  children: (session: AdminMeResponse) => ReactNode;
}) {
  const L = useL();
  const [state, setState] = useState<AccessState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'granted', session: await fetchAdminMe() });
    } catch (cause) {
      if (
        import.meta.env.DEV &&
        cause instanceof AdminApiError &&
        (cause.status === 401 || cause.status === 403)
      ) {
        try {
          await loginAsDebugGuest();
          setState({ status: 'granted', session: await fetchAdminMe() });
          return;
        } catch {
          setState({ status: 'unavailable', code: 'NETWORK_ERROR' });
          return;
        }
      }
      if (cause instanceof AdminApiError && cause.status === 401) {
        setState({ status: 'signed-out' });
      } else if (cause instanceof AdminApiError && cause.status === 403) {
        setState({ status: 'forbidden' });
      } else {
        setState({
          status: 'unavailable',
          code: cause instanceof AdminApiError ? cause.code : 'NETWORK_ERROR',
        });
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('oauth') === 'complete') {
        await consumeGoogleOAuthResult().catch(() => undefined);
        params.delete('oauth');
        const next = params.toString();
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`,
        );
      }
      if (!cancelled) {
        await load();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (state.status === 'loading') {
    return <AdminAccessState title={L('admin:routes.loading')} />;
  }
  if (state.status === 'granted') {
    return children(state.session);
  }
  if (state.status === 'signed-out') {
    return (
      <AdminAccessState
        title={L('admin:access.title.signIn')}
        description={L('admin:access.description.signIn')}
      >
        <button
          className="admin-button admin-primary"
          type="button"
          onClick={() => startGoogleOAuth('/admin')}
        >
          {L('auth:mapUserControls.text.signGoogle')}
        </button>
      </AdminAccessState>
    );
  }
  if (state.status === 'forbidden') {
    return (
      <AdminAccessState
        title={L('admin:access.title.forbidden')}
        description={L('admin:access.description.forbidden')}
      >
        <button
          className="admin-button admin-primary"
          type="button"
          onClick={() => startGoogleOAuth('/admin')}
        >
          {L('auth:mapUserControls.text.signGoogleAccount')}
        </button>
      </AdminAccessState>
    );
  }
  return (
    <AdminAccessState
      title={L('admin:access.title.unavailable')}
      description={L('admin:access.description.unavailable')}
      code={state.code}
    >
      <button
        className="admin-button admin-primary"
        type="button"
        onClick={() => void load()}
      >
        {L('common:action.retry')}
      </button>
    </AdminAccessState>
  );
}

function AdminAccessState({
  title,
  description,
  code,
  children,
}: {
  title: string;
  description?: string;
  code?: string;
  children?: ReactNode;
}) {
  return (
    <main className="admin-access-state">
      <h1 role="status">{title}</h1>
      {description && <p>{description}</p>}
      {code && <code>{code}</code>}
      {children}
    </main>
  );
}
