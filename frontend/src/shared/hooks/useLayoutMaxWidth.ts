import { useEffect, useState } from 'react';
import { matchesLayoutMaxWidth } from '@/shared/config/mobileLayout';

/** Shared by presentation code so forced mobile and viewport resizes agree. */
export function useLayoutMaxWidth(width = 760): boolean {
  const [matches, setMatches] = useState(() => matchesLayoutMaxWidth(width));
  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${width}px)`);
    const update = () => setMatches(matchesLayoutMaxWidth(width));
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [width]);
  return matches;
}
