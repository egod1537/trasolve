import { useEffect, useRef } from 'react';
import heroRoute from '../../assets/hero-route.svg';

export function HeroVisual() {
  const tiltRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0, active: 0 });

  useEffect(() => {
    const visual = tiltRef.current;
    if (!visual) return;

    const motion = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)',
    );
    let stopTracking = () => {};

    const configure = () => {
      stopTracking();
      if (!motion.matches) return;

      let frame = 0;
      const target = targetRef.current;
      target.x = target.y = target.active = 0;
      const current = { ...target };

      const animate = () => {
        current.x += (target.x - current.x) * 0.06;
        current.y += (target.y - current.y) * 0.06;
        current.active += (target.active - current.active) * 0.06;
        const settled =
          Math.abs(target.x - current.x) < 0.001 &&
          Math.abs(target.y - current.y) < 0.001 &&
          Math.abs(target.active - current.active) < 0.001;
        if (settled) Object.assign(current, target);

        visual.style.transform =
          `translate3d(${current.x * 10}px, ${current.y * 6}px, 0) ` +
          `rotateX(${-current.y * 5}deg) rotateY(${current.x * 6}deg) ` +
          `scale(${1 + current.active * 0.015})`;
        frame = settled ? 0 : requestAnimationFrame(animate);
      };

      const start = () => {
        if (!frame) frame = requestAnimationFrame(animate);
      };
      const track = (event: PointerEvent) => {
        if (event.pointerType !== 'mouse') return;
        const { innerWidth, innerHeight } = window;
        if (!innerWidth || !innerHeight) return;
        target.x = Math.max(
          -1,
          Math.min(1, (event.clientX / innerWidth - 0.5) * 2),
        );
        target.y = Math.max(
          -1,
          Math.min(1, (event.clientY / innerHeight - 0.5) * 2),
        );
        target.active = 1;
        start();
      };
      const leave = () => {
        target.x = target.y = target.active = 0;
        start();
      };
      const leaveViewport = (event: PointerEvent) => {
        // Internal element boundaries must not reset the viewport interaction.
        if (event.pointerType === 'mouse' && event.relatedTarget === null)
          leave();
      };
      window.addEventListener('pointermove', track, { passive: true });
      window.addEventListener('pointerout', leaveViewport, { passive: true });
      window.addEventListener('blur', leave);

      stopTracking = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('pointermove', track);
        window.removeEventListener('pointerout', leaveViewport);
        window.removeEventListener('blur', leave);
        visual.style.removeProperty('transform');
      };
    };

    configure();
    motion.addEventListener('change', configure);
    return () => {
      motion.removeEventListener('change', configure);
      stopTracking();
    };
  }, []);

  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-visual-tilt" ref={tiltRef}>
        <img src={heroRoute} alt="" decoding="async" draggable={false} />
      </div>
    </div>
  );
}
