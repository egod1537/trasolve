import type {
  MapObjectHandle,
  MapMarkerHandle,
  MapMarkerIcon,
  MapMarkerOptions,
} from '@/map/adapters/MapObjectController';

import {
  SVG_NAMESPACE,
  applyMarkerIcon,
} from '@/map/adapters/googleMarkerIcon';
type ObjectBinding = {
  setVisible(visible: boolean): void;
  setZIndex(zIndex: number): void;
  remove(): void;
};
export function createGoogleMarker(
  map: google.maps.Map | null,
  id: string,
  options: MapMarkerOptions,
  register: (
    id: string,
    layer: string | undefined,
    binding: ObjectBinding,
  ) => MapObjectHandle,
): MapMarkerHandle {
  const content = document.createElement('span');
  content.className = 'trip-map-marker';
  content.setAttribute('aria-hidden', 'true');
  const markerIcon = document.createElementNS(SVG_NAMESPACE, 'svg');
  markerIcon.classList.add('trip-map-marker-icon');
  markerIcon.setAttribute('fill', 'none');
  const markerLabel = document.createElement('span');
  markerLabel.className = 'trip-map-marker-label';
  const markerCallout = document.createElement('span');
  markerCallout.className = 'trip-map-marker-callout';
  markerCallout.hidden = true;
  const startBadge = document.createElement('span');
  startBadge.className = 'trip-map-marker-role-badge is-start';
  const startIcon = document.createElementNS(SVG_NAMESPACE, 'svg');
  applyMarkerIcon(startIcon, {
    viewBox: '0 0 24 24',
    paths: ['m8 5 11 7-11 7Z'],
  });
  startBadge.append(startIcon);
  const endBadge = document.createElement('span');
  endBadge.className = 'trip-map-marker-role-badge is-end';
  const endIcon = document.createElementNS(SVG_NAMESPACE, 'svg');
  applyMarkerIcon(endIcon, {
    viewBox: '0 0 24 24',
    paths: [
      'M5 21V3m0 1h14v12H5',
      'M5 4h5v4H5Zm9 0h5v4h-5ZM10 8h4v4h-4Zm-5 4h5v4H5Zm9 0h5v4h-5Z',
    ],
  });
  endBadge.append(endIcon);
  content.replaceChildren(
    markerIcon,
    markerLabel,
    markerCallout,
    startBadge,
    endBadge,
  );
  let marker: google.maps.marker.AdvancedMarkerElement | null =
    new google.maps.marker.AdvancedMarkerElement({
      map: options.visible === false ? null : map,
      position: { ...options.position },
      zIndex: options.zIndex ?? 0,
      gmpClickable: true,
      gmpDraggable: options.draggable ?? false,
      anchorLeft: '-50%',
      anchorTop: '-50%',
    });
  marker.replaceChildren(content);
  let visible = options.visible !== false;
  let zIndex = options.zIndex ?? 0;
  let position = options.position;
  let title: string | null = null;
  let selected: boolean | null = null;
  let color: string | null | undefined = null;
  let icon: MapMarkerIcon | null | undefined = null;
  let label: string | null | undefined = null;
  let emphasis: Parameters<MapMarkerHandle['setEmphasis']>[0] | null = null;
  let callout: Parameters<MapMarkerHandle['setCallout']>[0];
  let routeRole: Parameters<MapMarkerHandle['setRouteRole']>[0];
  let hovered = false;
  let focused = false;
  const syncCalloutEmphasis = () => {
    content.classList.toggle('is-callout-focused', focused);
    if (marker) {
      marker.zIndex =
        zIndex + (callout?.text && (hovered || focused) ? 100_000 : 0);
    }
  };
  const enter = () => {
    hovered = true;
    syncCalloutEmphasis();
  };
  const leave = () => {
    hovered = false;
    syncCalloutEmphasis();
  };
  const focus = () => {
    focused = true;
    syncCalloutEmphasis();
  };
  const blur = () => {
    focused = false;
    syncCalloutEmphasis();
  };
  content.addEventListener('pointerenter', enter);
  content.addEventListener('pointerleave', leave);
  marker.addEventListener('focusin', focus);
  marker.addEventListener('focusout', blur);
  const listeners = new Set<() => void>();
  const handleEntranceAnimationEnd = (event: AnimationEvent) => {
    if (event.animationName === 'trip-map-marker-enter') {
      content.classList.remove('is-entering');
    }
  };
  content.addEventListener('animationend', handleEntranceAnimationEnd);
  const base = register(id, options.layer, {
    setVisible: (nextVisible) => {
      if (!marker || visible === nextVisible) {
        return;
      }
      visible = nextVisible;
      if (!visible) {
        hovered = false;
        focused = false;
        syncCalloutEmphasis();
      }
      content.classList.toggle('is-entering', visible);
      marker.map = visible ? map : null;
    },
    setZIndex: (nextZIndex) => {
      if (marker && zIndex !== nextZIndex) {
        zIndex = nextZIndex;
        syncCalloutEmphasis();
      }
    },
    remove: () => {
      for (const unsubscribe of [...listeners]) {
        unsubscribe();
      }
      content.removeEventListener('animationend', handleEntranceAnimationEnd);
      content.removeEventListener('pointerenter', enter);
      content.removeEventListener('pointerleave', leave);
      if (marker) {
        marker.removeEventListener('focusin', focus);
        marker.removeEventListener('focusout', blur);
        marker.map = null;
        marker.replaceChildren();
        marker = null;
      }
      content.remove();
    },
  });
  const handle: MapMarkerHandle = {
    ...base,
    setPosition: (nextPosition) => {
      if (
        marker &&
        (position.lat !== nextPosition.lat || position.lng !== nextPosition.lng)
      ) {
        marker.position = { ...nextPosition };
        position = nextPosition;
      }
    },
    setTitle: (nextTitle) => {
      const resolvedTitle = nextTitle ?? '';
      if (marker && title !== resolvedTitle) {
        marker.title = resolvedTitle;
        title = resolvedTitle;
      }
    },
    setSelected: (nextSelected) => {
      if (!marker || selected === nextSelected) {
        return;
      }
      content.classList.toggle('is-selected', nextSelected);
      marker.setAttribute('aria-pressed', String(nextSelected));
      selected = nextSelected;
    },
    setColor: (nextColor) => {
      if (marker && color !== nextColor) {
        content.style.setProperty('--place-color', nextColor ?? '#2563eb');
        color = nextColor;
      }
    },
    setIcon: (nextIcon) => {
      if (marker && icon !== nextIcon) {
        applyMarkerIcon(markerIcon, nextIcon);
        icon = nextIcon;
      }
    },
    setLabel: (nextLabel) => {
      if (!marker || label === nextLabel) {
        return;
      }
      markerLabel.textContent = nextLabel ?? '';
      content.classList.toggle('has-label', Boolean(nextLabel));
      label = nextLabel;
    },
    setCallout: (nextCallout) => {
      if (
        !marker ||
        (callout?.text === nextCallout?.text &&
          callout?.visibility === nextCallout?.visibility)
      ) {
        return;
      }
      callout = nextCallout;
      markerCallout.textContent = nextCallout?.text ?? '';
      markerCallout.hidden = !nextCallout?.text;
      content.classList.toggle(
        'has-persistent-callout',
        nextCallout?.visibility === 'always',
      );
      if (nextCallout?.text) {
        marker.setAttribute('aria-description', nextCallout.text);
      } else {
        marker.removeAttribute('aria-description');
      }
      syncCalloutEmphasis();
    },
    setRouteRole: (nextRole) => {
      if (!marker || routeRole === nextRole) {
        return;
      }
      content.classList.toggle(
        'is-route-start',
        nextRole === 'start' || nextRole === 'start-end',
      );
      content.classList.toggle(
        'is-route-end',
        nextRole === 'end' || nextRole === 'start-end',
      );
      routeRole = nextRole;
    },
    setEmphasis: (nextEmphasis) => {
      if (!marker || emphasis === nextEmphasis) {
        return;
      }
      for (const value of ['selectable', 'source', 'target', 'unavailable']) {
        content.classList.toggle(`is-drawing-${value}`, nextEmphasis === value);
      }
      emphasis = nextEmphasis;
    },
    onDragEnd: (callback) => {
      const listener = marker?.addListener(
        'dragend',
        (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            callback({ lat: event.latLng.lat(), lng: event.latLng.lng() });
          }
        },
      );
      const unsubscribe = () => {
        listener?.remove();
        listeners.delete(unsubscribe);
      };
      listeners.add(unsubscribe);
      return unsubscribe;
    },
    onClick: (callback) => {
      if (!marker) {
        return () => undefined;
      }
      let target: google.maps.marker.AdvancedMarkerElement | null = marker;
      const listener = () => callback();
      target.addEventListener('gmp-click', listener);
      const unsubscribe = () => {
        target?.removeEventListener('gmp-click', listener);
        target = null;
        listeners.delete(unsubscribe);
      };
      listeners.add(unsubscribe);
      return unsubscribe;
    },
    onDoubleClick: (callback) => {
      const listener = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        callback();
      };
      content.addEventListener('dblclick', listener);
      const unsubscribe = () => {
        content.removeEventListener('dblclick', listener);
        listeners.delete(unsubscribe);
      };
      listeners.add(unsubscribe);
      return unsubscribe;
    },
    onContextMenu: (callback) => {
      const listener = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        callback({ clientX: event.clientX, clientY: event.clientY });
      };
      content.addEventListener('contextmenu', listener);
      const unsubscribe = () => {
        content.removeEventListener('contextmenu', listener);
        listeners.delete(unsubscribe);
      };
      listeners.add(unsubscribe);
      return unsubscribe;
    },
    onPointerEnter: (callback) => {
      const listener = () => callback();
      content.addEventListener('pointerenter', listener);
      const unsubscribe = () => {
        content.removeEventListener('pointerenter', listener);
        listeners.delete(unsubscribe);
      };
      listeners.add(unsubscribe);
      return unsubscribe;
    },
    onPointerLeave: (callback) => {
      const listener = () => callback();
      content.addEventListener('pointerleave', listener);
      const unsubscribe = () => {
        content.removeEventListener('pointerleave', listener);
        listeners.delete(unsubscribe);
      };
      listeners.add(unsubscribe);
      return unsubscribe;
    },
  };
  handle.setTitle(options.title);
  handle.setSelected(options.selected ?? false);
  handle.setColor(options.color);
  handle.setIcon(options.icon);
  handle.setLabel(options.label);
  handle.setCallout(options.callout);
  handle.setRouteRole(options.routeRole);
  handle.setEmphasis('none');
  return handle;
}
