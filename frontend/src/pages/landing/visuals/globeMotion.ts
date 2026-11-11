import { defaultGlobeTilt } from './cartography';

const idleDelay = 4000;
const recoveryDuration = 1200;
const maximumDragVelocity = 0.18;
const minimumCoastVelocity = 0.0005;
const cruiseVelocity = 0.002;

type ReturnView = { angle: number; elapsed: number };

// Integrate exponential acceleration/drag in milliseconds, independent of FPS.
function integrateVelocity(
  velocity: number,
  target: number,
  delta: number,
  decayTime: number,
) {
  const decay = Math.exp(-delta / decayTime);
  return {
    velocity: target + (velocity - target) * decay,
    angle: target * delta + (velocity - target) * decayTime * (1 - decay),
  };
}

// Presentation state only: manual input interrupts either automatic transition.
export function createGlobeMotion(initialAngle: number) {
  let angle = initialAngle;
  let dragging = false;
  let resumeAt: number | null = null;
  let returning: ReturnView | null = null;
  let recovering = false;
  let dragVelocity = 0;
  let autoVelocity = 0;
  const pause = () => {
    dragVelocity = 0;
    autoVelocity = 0;
  };
  const startReturn = () => {
    // Take the shortest path home, even after several full manual turns.
    angle = initialAngle + ((((angle - initialAngle) % 360) + 540) % 360) - 180;
    returning = { angle, elapsed: 0 };
  };
  const coast = (delta: number) => {
    if (Math.abs(dragVelocity) < minimumCoastVelocity) {
      dragVelocity = 0;
      return false;
    }
    const next = integrateVelocity(dragVelocity, 0, delta, 240);
    angle += next.angle;
    dragVelocity = next.velocity;
    return true;
  };
  return {
    get angle() {
      return angle;
    },
    get tilt() {
      return defaultGlobeTilt;
    },
    pause,
    begin() {
      dragging = true;
      resumeAt = null;
      returning = null;
      recovering = false;
      pause();
    },
    move(dx: number, delta: number) {
      angle += dx;
      const sample = Math.max(
        -maximumDragVelocity,
        Math.min(maximumDragVelocity, dx / Math.max(1, delta)),
      );
      dragVelocity += (sample - dragVelocity) * (1 - Math.exp(-delta / 45));
    },
    end(time: number, allowInertia: boolean) {
      dragging = false;
      if (!allowInertia) {
        dragVelocity = 0;
      }
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
        const changed = coast(delta);
        if (time < resumeAt) {
          return changed;
        }
        resumeAt = null;
        pause();
        recovering = true;
        startReturn();
      }
      if (returning) {
        returning.elapsed += delta;
        const duration = recovering ? recoveryDuration : returnDuration;
        const progress = Math.min(1, returning.elapsed / duration);
        const eased = 1 - (1 - progress) ** 3;
        angle = returning.angle + (initialAngle - returning.angle) * eased;
        if (progress === 1) {
          angle = initialAngle;
          returning = null;
          recovering = false;
          autoVelocity = 0;
        }
      } else if (angle >= returnAngle) {
        startReturn();
      } else {
        const next = integrateVelocity(
          autoVelocity,
          cruiseVelocity,
          delta,
          500,
        );
        autoVelocity = next.velocity;
        angle = Math.min(returnAngle, angle + next.angle);
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
  let pointer: { id: number; x: number; time: number } | null = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const down = (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || pointer) {
      return;
    }
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      time: performance.now(),
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = 'true';
    movement.begin();
  };
  const move = (event: PointerEvent) => {
    if (!pointer || event.pointerId !== pointer.id) {
      return;
    }
    const sensitivity = 180 / Math.max(1, canvas.getBoundingClientRect().width);
    const time = performance.now();
    // Only longitude changes. Vertical touch gestures remain native scrolling.
    movement.move(
      (event.clientX - pointer.x) * sensitivity,
      time - pointer.time,
    );
    pointer.x = event.clientX;
    pointer.time = time;
    draw();
  };
  const end = (event?: PointerEvent) => {
    if (!pointer || (event && event.pointerId !== pointer.id)) {
      return;
    }
    const { id, time: lastMovement } = pointer;
    const time = performance.now();
    const allowInertia =
      event?.type === 'pointerup' &&
      time - lastMovement < 100 &&
      !reducedMotion.matches;
    pointer = null;
    delete canvas.dataset.dragging;
    movement.end(time, allowInertia);
    if (canvas.hasPointerCapture(id)) {
      canvas.releasePointerCapture(id);
    }
  };
  const blur = () => {
    end();
    movement.pause();
  };
  const visibility = () => {
    if (document.hidden) {
      blur();
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
