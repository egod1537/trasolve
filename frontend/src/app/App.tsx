import { Suspense } from 'react';
import { ThemeProvider } from '../shared/theme/ThemeProvider';
import { resolveRoute } from './routes';

export function App() {
  const { Component, loadingLabel } = resolveRoute(window.location.pathname);

  return (
    <ThemeProvider>
      <Suspense fallback={<p role="status">{loadingLabel}</p>}>
        <Component />
      </Suspense>
    </ThemeProvider>
  );
}
