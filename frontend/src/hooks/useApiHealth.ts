import { useEffect, useState } from 'react';
import { checkApiHealth } from '../api/health';

export type ApiHealth = 'checking' | 'available' | 'unavailable';

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>('checking');

  useEffect(() => {
    const controller = new AbortController();

    void checkApiHealth(controller.signal)
      .then((isAvailable) => setHealth(isAvailable ? 'available' : 'unavailable'))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setHealth('unavailable');
        }
      });

    return () => controller.abort();
  }, []);

  return health;
}
