import { Suspense } from 'react';
import { AppProviders } from '@/app/providers/AppProviders';
import { resolveRoute } from '@/app/router/routes';

export function App() {
  const { Component, loadingLabel } = resolveRoute(window.location.pathname);

  return (
    <AppProviders>
      <Suspense fallback={<p role="status">{loadingLabel}</p>}>
        <Component />
      </Suspense>
    </AppProviders>
  );
}
