import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { GeoPoint } from '../types/mapTypes';
import { useGoogleMap } from './GoogleMap';
import './anchored-map-card.css';

type Props = {
  anchor: GeoPoint;
  anchorId?: string;
  children: ReactNode;
  occlusionRef?: RefObject<HTMLElement | null>;
};

type Placement = 'above' | 'below';

type Layout = {
  anchorKey: string | null;
  ready: boolean;
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  pointerX: number;
  placement: Placement;
  visible: boolean;
};

type AnchoredCardStyle = CSSProperties & {
  '--anchored-card-pointer-x': string;
};

type ViewportRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const CARD_WIDTH = 442;
const EDGE_GAP = 12;
const ANCHOR_GAP = 28;
const POINTER_EDGE_GAP = 22;
const PLACEMENT_HYSTERESIS = 24;

const initialLayout: Layout = {
  anchorKey: null,
  ready: false,
  left: 0,
  top: 0,
  width: CARD_WIDTH,
  maxHeight: 0,
  pointerX: CARD_WIDTH / 2,
  placement: 'above',
  visible: false,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function layoutsMatch(left: Layout, right: Layout): boolean {
  return (
    left.anchorKey === right.anchorKey &&
    left.ready === right.ready &&
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.maxHeight === right.maxHeight &&
    left.pointerX === right.pointerX &&
    left.placement === right.placement &&
    left.visible === right.visible
  );
}

function choosePlacement(
  desiredHeight: number,
  availableAbove: number,
  availableBelow: number,
  currentPlacement: Placement | null,
): Placement {
  const preferred: Placement =
    desiredHeight <= availableAbove || availableAbove >= availableBelow
      ? 'above'
      : 'below';
  if (!currentPlacement || currentPlacement === preferred) {
    return preferred;
  }

  const currentSpace =
    currentPlacement === 'above' ? availableAbove : availableBelow;
  const preferredSpace =
    preferred === 'above' ? availableAbove : availableBelow;
  if (desiredHeight <= currentSpace) {
    return currentPlacement;
  }
  if (currentSpace <= 0 && preferredSpace > 0) {
    return preferred;
  }
  return preferredSpace - currentSpace >= PLACEMENT_HYSTERESIS
    ? preferred
    : currentPlacement;
}

function containsPoint(rect: ViewportRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function getVisibleViewport(
  canvasRect: DOMRect,
  occlusionRect: DOMRect | undefined,
  anchorX: number,
  anchorY: number,
): { rect: ViewportRect; anchorOccluded: boolean } {
  const canvas = {
    left: canvasRect.left,
    top: canvasRect.top,
    right: canvasRect.right,
    bottom: canvasRect.bottom,
  };
  if (!occlusionRect) {
    return { rect: canvas, anchorOccluded: false };
  }

  const occlusion = {
    left: Math.max(canvas.left, occlusionRect.left),
    top: Math.max(canvas.top, occlusionRect.top),
    right: Math.min(canvas.right, occlusionRect.right),
    bottom: Math.min(canvas.bottom, occlusionRect.bottom),
  };
  if (occlusion.left >= occlusion.right || occlusion.top >= occlusion.bottom) {
    return { rect: canvas, anchorOccluded: false };
  }

  const candidates: ViewportRect[] = [
    { ...canvas, right: occlusion.left },
    { ...canvas, left: occlusion.right },
    { ...canvas, bottom: occlusion.top },
    { ...canvas, top: occlusion.bottom },
  ];
  const rect = candidates
    .filter(
      (candidate) =>
        candidate.left < candidate.right &&
        candidate.top < candidate.bottom &&
        containsPoint(candidate, anchorX, anchorY),
    )
    .sort(
      (left, right) =>
        (right.right - right.left) * (right.bottom - right.top) -
        (left.right - left.left) * (left.bottom - left.top),
    )[0];
  return {
    rect: rect ?? canvas,
    anchorOccluded: containsPoint(occlusion, anchorX, anchorY),
  };
}

/** Positions arbitrary card content against a geographic map coordinate. */
export function AnchoredMapCard({
  anchor,
  anchorId,
  children,
  occlusionRef,
}: Props) {
  const { overlayHost, canvasRef } = useGoogleMap();
  const cardRef = useRef<HTMLDivElement>(null);
  const initialPositionFrameRef = useRef(0);
  const positionedAnchorKeyRef = useRef<string | null>(null);
  const placementRef = useRef<Placement | null>(null);
  const [layout, setLayout] = useState(initialLayout);
  const lat = anchor.lat;
  const lng = anchor.lng;
  const anchorKey = `${anchorId ?? 'coordinate'}:${lat}:${lng}`;

  const calculateLayout = useCallback(
    (currentPlacement: Placement | null): Layout | null => {
      const card = cardRef.current;
      const canvas = canvasRef.current;
      if (!card || !canvas) {
        return null;
      }

      const point = overlayHost.project({ lat, lng });
      if (!point) {
        return null;
      }

      const hostRect = overlayHost.getElement().getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const anchorX = hostRect.left + point.x;
      const anchorY = hostRect.top + point.y;
      const viewport = getVisibleViewport(
        canvasRect,
        occlusionRef?.current?.getBoundingClientRect(),
        anchorX,
        anchorY,
      );
      const viewportLeft = viewport.rect.left - hostRect.left + EDGE_GAP;
      const viewportTop = viewport.rect.top - hostRect.top + EDGE_GAP;
      const viewportRight = viewport.rect.right - hostRect.left - EDGE_GAP;
      const viewportBottom = viewport.rect.bottom - hostRect.top - EDGE_GAP;
      const anchorInViewport =
        containsPoint(viewport.rect, anchorX, anchorY) &&
        !viewport.anchorOccluded;
      const width = Math.max(
        0,
        Math.min(CARD_WIDTH, viewportRight - viewportLeft),
      );
      const availableAbove = Math.max(0, point.y - ANCHOR_GAP - viewportTop);
      const availableBelow = Math.max(0, viewportBottom - point.y - ANCHOR_GAP);
      const content = card.firstElementChild;
      const desiredHeight =
        content instanceof HTMLElement
          ? Math.max(
              content.scrollHeight,
              content.getBoundingClientRect().height,
            )
          : card.getBoundingClientRect().height;
      const placement = choosePlacement(
        desiredHeight,
        availableAbove,
        availableBelow,
        currentPlacement,
      );
      const maxHeight = placement === 'above' ? availableAbove : availableBelow;
      const renderedHeight = Math.min(desiredHeight, maxHeight);
      const left = clamp(
        point.x - width / 2,
        viewportLeft,
        Math.max(viewportLeft, viewportRight - width),
      );
      const top =
        placement === 'above'
          ? point.y - ANCHOR_GAP - renderedHeight
          : point.y + ANCHOR_GAP;
      const pointerX = clamp(
        point.x - left,
        Math.min(POINTER_EDGE_GAP, width / 2),
        Math.max(width - POINTER_EDGE_GAP, width / 2),
      );
      const next: Layout = {
        anchorKey,
        ready: true,
        left,
        top,
        width,
        maxHeight,
        pointerX,
        placement,
        visible: anchorInViewport && width > 0 && maxHeight > 0,
      };
      return next;
    },
    [anchorKey, canvasRef, lat, lng, occlusionRef, overlayHost],
  );

  const updateLayout = useCallback(() => {
    const positioned = positionedAnchorKeyRef.current === anchorKey;
    const next = calculateLayout(positioned ? placementRef.current : null);
    if (!next) {
      return;
    }

    if (!positioned) {
      if (initialPositionFrameRef.current) {
        return;
      }
      placementRef.current = null;
      setLayout((current) => {
        const measuring = { ...next, ready: false };
        return layoutsMatch(current, measuring) ? current : measuring;
      });
      initialPositionFrameRef.current = requestAnimationFrame(() => {
        initialPositionFrameRef.current = requestAnimationFrame(() => {
          initialPositionFrameRef.current = 0;
          const confirmed = calculateLayout(null);
          if (!confirmed || confirmed.anchorKey !== anchorKey) {
            return;
          }
          positionedAnchorKeyRef.current = anchorKey;
          placementRef.current = confirmed.placement;
          setLayout((current) =>
            layoutsMatch(current, confirmed) ? current : confirmed,
          );
        });
      });
      return;
    }

    placementRef.current = next.placement;
    setLayout((current) => (layoutsMatch(current, next) ? current : next));
  }, [anchorKey, calculateLayout]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const canvas = canvasRef.current;
    if (!card || !canvas) {
      return;
    }

    const observer = new ResizeObserver(updateLayout);
    observer.observe(card);
    observer.observe(canvas);
    if (occlusionRef?.current) {
      observer.observe(occlusionRef.current);
    }
    const unsubscribe = overlayHost.subscribeDraw(updateLayout);
    updateLayout();
    return () => {
      cancelAnimationFrame(initialPositionFrameRef.current);
      initialPositionFrameRef.current = 0;
      observer.disconnect();
      unsubscribe();
    };
  }, [canvasRef, occlusionRef, overlayHost, updateLayout]);

  const layoutMatchesAnchor = layout.anchorKey === anchorKey;
  const layoutReady = layoutMatchesAnchor && layout.ready && layout.visible;
  const style: AnchoredCardStyle = {
    transform: `translate3d(${layout.left}px, ${layout.top}px, 0)`,
    width: layoutMatchesAnchor ? layout.width : CARD_WIDTH,
    maxHeight: layoutMatchesAnchor && layout.ready ? layout.maxHeight : 'none',
    opacity: layoutReady ? 1 : 0,
    visibility: layoutReady ? 'visible' : 'hidden',
    '--anchored-card-pointer-x': `${layout.pointerX}px`,
  };

  return createPortal(
    <div
      ref={cardRef}
      className={`anchored-map-card is-${layout.placement}`}
      style={style}
    >
      {children}
    </div>,
    overlayHost.getElement(),
  );
}
