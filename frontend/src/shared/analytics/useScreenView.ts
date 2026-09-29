import { useEffect } from 'react';
import type { AnalyticsScreen } from '@trasolve/shared';
import { screenView } from '@/shared/analytics/client';

/**
 * Tracks a committed screen mount. Deferring delivery lets the StrictMode probe
 * cleanup cancel its first scheduled event before the real effect runs.
 */
export function useScreenView(screen: AnalyticsScreen): void {
  useEffect(() => {
    const timeoutId = window.setTimeout(() => screenView(screen), 0);
    return () => window.clearTimeout(timeoutId);
  }, [screen]);
}
