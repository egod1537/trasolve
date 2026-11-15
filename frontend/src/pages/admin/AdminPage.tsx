import type { AdminMeResponse } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { AdminAccessGate } from './AdminAccessGate';
import { AdminShell } from './AdminShell';
import { AdminDashboard } from './AdminDashboard';
import { AdminUsers } from './AdminUsers';
import { AdminTrips } from './AdminTrips';
import { AdminUsage } from './AdminUsage';
import { AdminOperations } from './AdminOperations';
import { AdminAudit } from './AdminAudit';
import './admin.css';

export default function AdminPage() {
  return (
    <AdminAccessGate>
      {(session) => (
        <AdminShell session={session}>
          <AdminContent session={session} />
        </AdminShell>
      )}
    </AdminAccessGate>
  );
}

function AdminContent({ session }: { session: AdminMeResponse }) {
  const L = useL();
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  switch (path) {
    case '/admin':
      return <AdminDashboard />;
    case '/admin/users':
      return <AdminUsers session={session} />;
    case '/admin/trips':
      return <AdminTrips />;
    case '/admin/api-usage':
      return <AdminUsage />;
    case '/admin/operations':
      return <AdminOperations />;
    case '/admin/audit':
      return <AdminAudit />;
    default:
      return (
        <div className="admin-empty">
          <h1>{L('admin:common.notFound')}</h1>
          <a className="admin-button" href="/admin">
            {L('admin:navigation.dashboard')}
          </a>
        </div>
      );
  }
}
