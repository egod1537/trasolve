import { Suspense } from 'react';
import { resolveRoute } from './src/routes';

export function App() {
  const { Component, loadingLabel } = resolveRoute(window.location.pathname);

  return (
    <Suspense fallback={<p role="status">{loadingLabel}</p>}>
      <Component />
    </Suspense>
  );
}
