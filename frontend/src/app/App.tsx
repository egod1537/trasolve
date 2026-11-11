import { Suspense } from 'react';
import { AppProviders } from '@/app/providers/AppProviders';
import { SmoothScrolling } from '@/app/providers/SmoothScrolling';
import { resolveRoute } from '@/app/router/routes';
import { ExternalApiDisabledNotice } from '@/shared/ui/ExternalApiDisabledNotice';

export function App() {
  const { Component, loadingLabel } = resolveRoute(window.location.pathname);

  return (
    <AppProviders>
      <SmoothScrolling />
      <ExternalApiDisabledNotice />
      <Suspense fallback={<p role="status">{loadingLabel}</p>}>
        <Component />
      </Suspense>
    </AppProviders>
  );
}
