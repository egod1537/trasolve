import {
  useId,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';

const DETAIL_CARD_WIDTH = 280;
const DETAIL_CARD_GAP = 10;
const VIEWPORT_EDGE_GAP = 12;
const MIN_VISIBLE_CARD_HEIGHT = 160;

type PlacementOptions = {
  anchorKey: string;
  sidebarRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  width?: number;
};

type Props = {
  id: string;
  title: string;
  subtitle: string;
  anchorKey: string;
  sidebarRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  onClose: () => void;
};

function findAnchor(
  sidebar: HTMLElement,
  anchorKey: string,
): HTMLElement | null {
  const item = Array.from(
    sidebar.querySelectorAll<HTMLElement>('[data-layer-item-key]'),
  ).find((element) => element.dataset.layerItemKey === anchorKey);
  return (
    item?.querySelector<HTMLElement>(':scope > .trip-layer-row') ?? item ?? null
  );
}

export function useLayerDetailCardPlacement({
  anchorKey,
  sidebarRef,
  onClose,
  width: preferredWidth = DETAIL_CARD_WIDTH,
}: PlacementOptions): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    const host = sidebar?.closest<HTMLElement>('.trip-map-page');
    const anchor = sidebar ? findAnchor(sidebar, anchorKey) : null;
    const scrollContainer = anchor?.closest<HTMLElement>(
      '.trip-sidebar-scroll',
    );
    if (!sidebar || !host || !anchor || !scrollContainer) {
      onClose();
      return;
    }

    let positionFrame = 0;
    const updatePosition = () => {
      positionFrame = 0;
      const hostRect = host.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const scrollRect = scrollContainer.getBoundingClientRect();
      const visibleTop = Math.max(hostRect.top, scrollRect.top, 0);
      const visibleRight = Math.min(
        hostRect.right,
        scrollRect.right,
        window.innerWidth,
      );
      const visibleBottom = Math.min(
        hostRect.bottom,
        scrollRect.bottom,
        window.innerHeight,
      );
      const visibleLeft = Math.max(hostRect.left, scrollRect.left, 0);
      const anchorHidden =
        anchorRect.width === 0 ||
        anchorRect.height === 0 ||
        anchorRect.bottom <= visibleTop ||
        anchorRect.top >= visibleBottom ||
        anchorRect.right <= visibleLeft ||
        anchorRect.left >= visibleRight;
      if (anchorHidden) {
        onClose();
        return;
      }

      const availableWidth = Math.max(
        0,
        hostRect.width - VIEWPORT_EDGE_GAP * 2,
      );
      const width = Math.min(preferredWidth, availableWidth);
      const panelLeft = sidebarRect.left - hostRect.left;
      const panelRight = sidebarRect.right - hostRect.left;
      const maximumLeft = hostRect.width - VIEWPORT_EDGE_GAP - width;
      const preferredRight = panelRight + DETAIL_CARD_GAP;
      const preferredLeft = panelLeft - DETAIL_CARD_GAP - width;
      const left =
        preferredRight <= maximumLeft
          ? preferredRight
          : preferredLeft >= VIEWPORT_EDGE_GAP
            ? preferredLeft
            : Math.max(VIEWPORT_EDGE_GAP, maximumLeft);
      const availableHeight = Math.max(
        0,
        hostRect.height - VIEWPORT_EDGE_GAP * 2,
      );
      const minimumHeight = Math.min(MIN_VISIBLE_CARD_HEIGHT, availableHeight);
      const maximumTop = Math.max(
        VIEWPORT_EDGE_GAP,
        hostRect.height - VIEWPORT_EDGE_GAP - minimumHeight,
      );
      const preferredTop = anchorRect.top - hostRect.top;
      const top = Math.min(
        Math.max(VIEWPORT_EDGE_GAP, preferredTop),
        maximumTop,
      );

      setStyle({
        visibility: 'visible',
        left,
        top,
        width,
        maxHeight: Math.max(0, hostRect.height - top - VIEWPORT_EDGE_GAP),
      });
    };
    const schedulePositionUpdate = () => {
      cancelAnimationFrame(positionFrame);
      positionFrame = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    const resizeObserver = new ResizeObserver(schedulePositionUpdate);
    resizeObserver.observe(anchor);
    resizeObserver.observe(scrollContainer);
    resizeObserver.observe(sidebar);
    resizeObserver.observe(host);
    const mutationObserver = new MutationObserver(schedulePositionUpdate);
    mutationObserver.observe(sidebar, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style'],
      childList: true,
      subtree: true,
    });
    scrollContainer.addEventListener('scroll', schedulePositionUpdate, {
      passive: true,
    });
    window.addEventListener('resize', schedulePositionUpdate);
    return () => {
      cancelAnimationFrame(positionFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      scrollContainer.removeEventListener('scroll', schedulePositionUpdate);
      window.removeEventListener('resize', schedulePositionUpdate);
    };
  }, [anchorKey, onClose, preferredWidth, sidebarRef]);

  return style;
}

export function LayerDetailCard({
  id,
  title,
  subtitle,
  anchorKey,
  sidebarRef,
  children,
  onClose,
}: Props) {
  const titleId = useId();
  const style = useLayerDetailCardPlacement({
    anchorKey,
    sidebarRef,
    onClose,
  });

  return (
    <aside
      id={id}
      className="layer-detail-card"
      style={style}
      aria-labelledby={titleId}
      data-layer-detail-card
    >
      <header className="layer-detail-card-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </header>
      <div className="layer-detail-card-body">{children}</div>
    </aside>
  );
}
