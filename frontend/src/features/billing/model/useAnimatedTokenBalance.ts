import { useEffect, useRef, useState } from 'react';

export function useAnimatedTokenBalance(
  target: number | undefined,
): number | undefined {
  const [displayed, setDisplayed] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (
      target === undefined ||
      from === undefined ||
      target >= from ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      current.current = target;
      setDisplayed(target);
      return;
    }
    let started: number | undefined;
    let frame = 0;
    const tick = (now: number) => {
      started ??= now;
      const progress = Math.min(1, (now - started) / 720);
      const eased = 1 - (1 - progress) ** 3;
      current.current = Math.round(from + (target - from) * eased);
      setDisplayed(current.current);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target]);
  return displayed;
}
