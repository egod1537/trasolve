import * as Sentry from '@sentry/react';
import type { ReactNode } from 'react';
import { buildInfo } from '@/shared/config/buildInfo';
import { L } from '@/shared/i18n';

export function SentryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary fallback={renderFallback}>
      {children}
    </Sentry.ErrorBoundary>
  );
}

function renderFallback({ error }: { error: unknown }) {
  return (
    <main className="app-error-fallback" role="alert">
      <h1>{L('common:status.error')}</h1>
      <button type="button" onClick={() => window.location.reload()}>
        {L('common:action.refresh')}
      </button>
      {buildInfo.channel === 'local' ? <pre>{formatError(error)}</pre> : null}
    </main>
  );
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}
