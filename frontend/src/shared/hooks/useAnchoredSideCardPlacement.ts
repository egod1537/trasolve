import { useLayoutEffect, useState, type RefObject } from 'react';

export type AnchoredSideCardPlacement = 'left' | 'overlay' | 'right';

const SIDE_CARD_GAP = 10;
const VIEWPORT_EDGE_GAP = 12;

export function useAnchoredSideCardPlacement({
  open,
  groupRef,
  mainCardRef,
  sideCardRef,
}: {
  open: boolean;
  groupRef: RefObject<HTMLElement | null>;
  mainCardRef: RefObject<HTMLElement | null>;
  sideCardRef: RefObject<HTMLElement | null>;
}): AnchoredSideCardPlacement {
  const [placement, setPlacement] =
    useState<AnchoredSideCardPlacement>('right');

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const mainCard = mainCardRef.current;
    const sideCard = sideCardRef.current;
    if (!mainCard || !sideCard) {
      return;
    }

    let animationFrame = 0;
    const measurePlacement = () => {
      const mainRect = mainCard.getBoundingClientRect();
      const requiredSpace =
        sideCard.offsetWidth + SIDE_CARD_GAP + VIEWPORT_EDGE_GAP;
      const nextPlacement: AnchoredSideCardPlacement =
        window.innerWidth - mainRect.right >= requiredSpace
          ? 'right'
          : mainRect.left >= requiredSpace
            ? 'left'
            : 'overlay';
      setPlacement((current) =>
        current === nextPlacement ? current : nextPlacement,
      );
    };
    const scheduleMeasurement = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(measurePlacement);
    };

    measurePlacement();
    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    resizeObserver.observe(mainCard);
    resizeObserver.observe(sideCard);

    const overlayRoot = groupRef.current?.closest('.anchored-map-card');
    const positionObserver = new MutationObserver(scheduleMeasurement);
    if (overlayRoot) {
      positionObserver.observe(overlayRoot, {
        attributeFilter: ['style'],
        attributes: true,
      });
    }
    window.addEventListener('resize', scheduleMeasurement);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      positionObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasurement);
    };
  }, [groupRef, mainCardRef, open, sideCardRef]);

  return placement;
}
