import { defaultGlobeTilt } from './cartography';

const idleDelay = 4000;
const recoveryDuration = 1200;

type ReturnView = { angle: number; tilt: number; elapsed: number };

// Presentation state only: manual input interrupts either automatic transition.
export function createGlobeMotion(initialAngle: number) {
  let angle = initialAngle;
  let tilt = defaultGlobeTilt;
  let dragging = false;
  let resumeAt: number | null = null;
  let returning: ReturnView | null = null;
  let recovering = false;
  const startReturn = () => {
    // Take the shortest path home, even after several full manual turns.
    angle = initialAngle + ((((angle - initialAngle) % 360) + 540) % 360) - 180;
    returning = { angle, tilt, elapsed: 0 };
  };
  return {
    get angle() {
      return angle;
    },
    get tilt() {
      return tilt;
    },
    begin() {
      dragging = true;
      resumeAt = null;
      returning = null;
    },
    move(dx: number, dy: number) {
      angle += dx;
      tilt = Math.max(-55, Math.min(65, tilt + dy));
    },
    end(time: number) {
      dragging = false;
      resumeAt = time + idleDelay;
    },
    advance(
      delta: number,
      time: number,
      returnAngle: number,
      returnDuration: number,
    ) {
      if (dragging) {
        return false;
      }
      if (resumeAt !== null) {
        if (time < resumeAt) {
          return false;
        }
        resumeAt = null;
        recovering = true;
        startReturn();
      }
      if (returning) {
        returning.elapsed += delta;
        const duration = recovering ? recoveryDuration : returnDuration;
        const progress = Math.min(1, returning.elapsed / duration);
        const eased = 1 - (1 - progress) ** 3;
        angle = returning.angle + (initialAngle - returning.angle) * eased;
        tilt = returning.tilt + (defaultGlobeTilt - returning.tilt) * eased;
        if (progress === 1) {
          angle = initialAngle;
          tilt = defaultGlobeTilt;
          returning = null;
          recovering = false;
        }
      } else if (angle >= returnAngle) {
        startReturn();
      } else {
        angle = Math.min(returnAngle, angle + delta * 0.002);
      }
      return true;
    },
  };
}

export function attachGlobeInteraction(
  canvas: HTMLCanvasElement,
  movement: ReturnType<typeof createGlobeMotion>,
  draw: () => void,
) {
  let pointer: { id: number; x: number; y: number } | null = null;
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || pointer) {
      return;
    }
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = 'true';
    movement.begin();
  };
  const move = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) {
      return;
    }
    const sensitivity = 180 / Math.max(1, canvas.getBoundingClientRect().width);
    // Vertical touch gestures remain native page scrolling (touch-action: pan-y).
    movement.move(
      (event.clientX - pointer.x) * sensitivity,
      event.pointerType === 'touch'
        ? 0
        : (event.clientY - pointer.y) * sensitivity,
    );
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    draw();
  };
  const end = (event?: PointerEvent) => {
    if (!pointer || (event && event.pointerId !== pointer.id)) {
      return;
    }
    const id = pointer.id;
    pointer = null;
    delete canvas.dataset.dragging;
    movement.end(performance.now());
    if (canvas.hasPointerCapture(id)) {
      canvas.releasePointerCapture(id);
    }
  };
  const blur = () => end();
  const visibility = () => {
    if (document.hidden) {
      end();
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  window.addEventListener('blur', blur);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    end();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', end);
    canvas.removeEventListener('pointercancel', end);
    canvas.removeEventListener('lostpointercapture', end);
    window.removeEventListener('blur', blur);
    document.removeEventListener('visibilitychange', visibility);
  };
}
