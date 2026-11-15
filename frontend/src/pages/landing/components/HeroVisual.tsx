import { useEffect, useRef } from 'react';
import { animateGlobe } from '@/pages/landing/visuals/animateGlobe';

export function HeroVisual() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      return animateGlobe(canvas);
    }
  }, []);

  return (
    <div className="hero-visual" aria-hidden="true">
      <canvas ref={canvasRef} className="hero-globe" />
    </div>
  );
}
