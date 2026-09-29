import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { ANALYTICS_SCREENS, ANALYTICS_TARGETS } from '@trasolve/shared';
import { useL } from '@/shared/i18n';
import { trackEvent } from '@/shared/analytics';

type Props = {
  id: string;
  placeName: string;
  anchorRef: RefObject<HTMLElement | null>;
  busy: boolean;
  confirmDisabled: boolean;
  onCancel: (restoreFocus: boolean) => void;
  onConfirm: () => void;
};

type ConfirmCardLayout = {
  left: number;
  top: number;
  width: number;
  ready: boolean;
};

const CARD_WIDTH = 320;
const VIEWPORT_GAP = 12;
const CARD_GAP = 10;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function layoutsMatch(
  current: ConfirmCardLayout,
  next: ConfirmCardLayout,
): boolean {
  return (
    current.left === next.left &&
    current.top === next.top &&
    current.width === next.width &&
    current.ready === next.ready
  );
}

export function PlaceDeleteConfirmCard({
  id,
  placeName,
  anchorRef,
  busy,
  confirmDisabled,
  onCancel,
  onConfirm,
}: Props) {
  const L = useL();
  const titleId = useId();
  const descriptionId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const layoutRef = useRef<ConfirmCardLayout>({
    left: 0,
    top: 0,
    width: CARD_WIDTH,
    ready: false,
  });
  const [layout, setLayout] = useState<ConfirmCardLayout>({
    left: 0,
    top: 0,
    width: CARD_WIDTH,
    ready: false,
  });

  useLayoutEffect(() => {
    if (layout.ready) {
      cancelButtonRef.current?.focus();
    }
  }, [layout.ready]);

  useLayoutEffect(() => {
    const updateLayout = () => {
      const anchor = anchorRef.current;
      const card = cardRef.current;
      const group = anchor?.parentElement;
      if (!anchor || !card || !group) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      const cardHeight = card.getBoundingClientRect().height;
      const width = Math.max(
        0,
        Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_GAP * 2),
      );
      const viewportLeft = clamp(
        anchorRect.right - width,
        VIEWPORT_GAP,
        Math.max(VIEWPORT_GAP, window.innerWidth - width - VIEWPORT_GAP),
      );
      const aboveTop = anchorRect.top - cardHeight - CARD_GAP;
      const belowTop = anchorRect.bottom + CARD_GAP;
      const viewportTop =
        aboveTop >= VIEWPORT_GAP
          ? aboveTop
          : belowTop + cardHeight <= window.innerHeight - VIEWPORT_GAP
            ? belowTop
            : clamp(
                aboveTop,
                VIEWPORT_GAP,
                Math.max(
                  VIEWPORT_GAP,
                  window.innerHeight - cardHeight - VIEWPORT_GAP,
                ),
              );
      const next = {
        left: viewportLeft - groupRect.left,
        top: viewportTop - groupRect.top,
        width,
        ready: true,
      };
      if (!layoutsMatch(layoutRef.current, next)) {
        layoutRef.current = next;
        setLayout(next);
      }
    };
    const anchor = anchorRef.current;
    const card = cardRef.current;
    const group = anchor?.parentElement;
    if (!anchor || !card || !group) {
      return;
    }

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(anchor);
    resizeObserver.observe(card);
    const positionRoot = group.closest('.anchored-map-card');
    const mutationObserver = new MutationObserver(updateLayout);
    mutationObserver.observe(group, {
      attributes: true,
      attributeFilter: ['style'],
    });
    if (positionRoot && positionRoot !== group) {
      mutationObserver.observe(positionRoot, {
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    }
    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);
    const frame = requestAnimationFrame(updateLayout);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onCancel(true);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (busy || !(event.target instanceof Node)) {
        return;
      }
      if (
        cardRef.current?.contains(event.target) ||
        anchorRef.current?.contains(event.target)
      ) {
        return;
      }
      onCancel(false);
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [anchorRef, busy, onCancel]);

  const style: CSSProperties = {
    left: layout.left,
    top: layout.top,
    width: layout.width,
    visibility: layout.ready ? 'visible' : 'hidden',
  };

  return (
    <section
      id={id}
      ref={cardRef}
      className="place-delete-confirm-card"
      style={style}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-label={L('place:placeDeleteConfirmCard.ariaLabel.confirmDeletion', {
        placeName: placeName,
      })}
    >
      <div className="place-delete-confirm-copy">
        <strong id={titleId}>
          {L('place:placeDeleteConfirmCard.text.youSureYouWantDeleteIt')}
        </strong>
        <p id={descriptionId}>
          {L(
            'place:placeDeleteConfirmCard.text.willBeRemovedFromCurrentSchedule',
            { placeName: placeName },
          )}
        </p>
      </div>
      <div className="place-delete-confirm-actions">
        <button
          ref={cancelButtonRef}
          type="button"
          disabled={busy}
          onClick={() => onCancel(true)}
        >
          {L('common:action.cancel')}
        </button>
        <button
          type="button"
          className="is-destructive"
          data-analytics-id={ANALYTICS_TARGETS.removePlace}
          data-analytics-screen={ANALYTICS_SCREENS.placeDetail}
          aria-label={L(
            'place:placeDeleteConfirmCard.ariaLabel.removeFromCalendar',
            { placeName: placeName },
          )}
          aria-busy={busy}
          disabled={confirmDisabled}
          onClick={() => {
            trackEvent({
              eventType: 'button_click',
              screen: ANALYTICS_SCREENS.placeDetail,
              target: ANALYTICS_TARGETS.removePlace,
            });
            onConfirm();
          }}
        >
          {busy
            ? L('place:placeDeleteConfirmCard.action.deleting')
            : L('common:action.delete')}
        </button>
      </div>
    </section>
  );
}
