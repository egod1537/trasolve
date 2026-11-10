import { useEffect, useState, type ReactNode } from 'react';
import { BillingProvider } from '@/features/billing';
import {
  fetchCurrentUser,
  useLoginDialog,
  LoginDialogProvider,
} from '@/features/auth';
import { AUTH_SESSION_EVENT } from '@/shared/api/authEvents';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LoginDialogProvider>
        <BillingSession>{children}</BillingSession>
      </LoginDialogProvider>
    </ThemeProvider>
  );
}

function BillingSession({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const login = useLoginDialog();
  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    const reload = async () => {
      const current = ++revision;
      try {
        const user = await fetchCurrentUser();
        if (!cancelled && current === revision) {
          setUserId(user?.id ?? null);
        }
      } catch {
        if (!cancelled && current === revision) {
          setUserId(null);
        }
      }
    };
    const onChange = () => {
      void reload();
    };
    onChange();
    window.addEventListener(AUTH_SESSION_EVENT, onChange);
    window.addEventListener('focus', onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_SESSION_EVENT, onChange);
      window.removeEventListener('focus', onChange);
    };
  }, []);
  return (
    <BillingProvider
      key={userId ?? 'signed-out'}
      userId={userId}
      login={() => login(window.location.pathname + window.location.search)}
    >
      {children}
    </BillingProvider>
  );
}
