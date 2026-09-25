import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  placeName: string;
  anchor: { x: number; y: number };
  isStart: boolean;
  isEnd: boolean;
  onSetStart: () => void;
  onSetEnd: () => void;
  onClose: () => void;
};

const VIEWPORT_MARGIN = 10;
const ANCHOR_OFFSET = 8;

export function RouteEndpointContextMenu({
  placeName,
  anchor,
  isStart,
  isEnd,
  onSetStart,
  onSetEnd,
  onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: anchor.x + ANCHOR_OFFSET,
    top: anchor.y + ANCHOR_OFFSET,
    ready: false,
  });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const bounds = menu.getBoundingClientRect();
    setPosition({
      left: clamp(
        anchor.x + ANCHOR_OFFSET,
        VIEWPORT_MARGIN,
        window.innerWidth - bounds.width - VIEWPORT_MARGIN,
      ),
      top: clamp(
        anchor.y + ANCHOR_OFFSET,
        VIEWPORT_MARGIN,
        window.innerHeight - bounds.height - VIEWPORT_MARGIN,
      ),
      ready: true,
    });
    menu.querySelector<HTMLButtonElement>('button')?.focus({
      preventScroll: true,
    });
  }, [anchor.x, anchor.y]);

  useEffect(() => {
    const closeFromOutside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        onClose();
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', closeFromOutside, true);
    window.addEventListener('keydown', closeFromKeyboard, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', closeFromOutside, true);
      window.removeEventListener('keydown', closeFromKeyboard, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      className="route-endpoint-context-menu"
      role="menu"
      aria-label={`${placeName} 시작점 및 도착점 설정`}
      style={{
        left: position.left,
        top: position.top,
        visibility: position.ready ? 'visible' : 'hidden',
      }}
    >
      <strong>{placeName}</strong>
      <div>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={isStart}
          className={`is-start${isStart ? ' is-active' : ''}`}
          onClick={() => {
            onSetStart();
            onClose();
          }}
        >
          {isStart ? '✓ 시작점' : '시작점으로 설정'}
        </button>
        <button
          type="button"
          role="menuitemradio"
          aria-checked={isEnd}
          className={`is-end${isEnd ? ' is-active' : ''}`}
          onClick={() => {
            onSetEnd();
            onClose();
          }}
        >
          {isEnd ? '✓ 도착점' : '도착점으로 설정'}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
