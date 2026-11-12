import { useEffect } from 'react';

export type PaymentCelebration = {
  orderId: string;
  plan: 'free' | 'plus' | 'pro';
};

const COLORS = {
  free: ['#2f6fed', '#8bb7ff', '#ffffff'],
  plus: ['#cbd5e1', '#f1f5f9', '#60a5fa', '#2f6fed'],
  pro: ['#d4af37', '#f5d77b', '#fff0bd', '#b8860b'],
};

export function usePaymentCelebration(payment: PaymentCelebration | null) {
  useEffect(() => {
    if (
      !payment ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    let disposed = false;
    let canvas: HTMLCanvasElement | undefined;
    let reset: (() => void) | undefined;
    const timers: number[] = [];
    const cleanup = () => {
      disposed = true;
      timers.forEach(window.clearTimeout);
      reset?.();
      canvas?.remove();
    };

    // Load the animation only after a confirmed payment; failures never affect checkout.
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (disposed) {
          return;
        }
        canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText =
          'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647';
        document.body.append(canvas);
        const fire = confetti.create(canvas, {
          resize: true,
          useWorker: true,
          disableForReducedMotion: true,
        });
        reset = () => fire.reset();
        const burst = () => {
          const options = {
            particleCount: 40,
            spread: 65,
            startVelocity: 48,
            gravity: 1.1,
            ticks: 180,
            colors: COLORS[payment.plan],
          };
          void fire({ ...options, angle: 60, origin: { x: 0, y: 0.85 } });
          void fire({ ...options, angle: 120, origin: { x: 1, y: 0.85 } });
        };
        burst();
        timers.push(
          window.setTimeout(burst, 250),
          window.setTimeout(burst, 500),
        );
        timers.push(window.setTimeout(cleanup, 4500));
      })
      .catch(cleanup);

    return cleanup;
  }, [payment]);
}
