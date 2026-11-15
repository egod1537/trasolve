import type { AdminUserSummary } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { Badge } from '@/pages/admin/AdminPrimitives';

export type UserAction = 'suspend' | 'restore' | 'revoke-sessions';

export function UserState({ user }: { user: AdminUserSummary }) {
  const L = useL();
  return (
    <Badge tone={user.state === 'active' ? 'success' : 'danger'}>
      {user.state === 'active'
        ? L('admin:users.state.active')
        : L('admin:users.state.suspended')}
    </Badge>
  );
}
