import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { MapAdapter } from '../../adapters/map/MapAdapter';
import type { MapOverlayHost } from '../../adapters/map/MapOverlayHost';
import {
  createGoogleMapRuntime,
  type MapRuntime,
} from '../../maps/createGoogleMapRuntime';
import { mapsAuthErrorEvent, mapsConfig } from '../../maps/googleMaps';
import type { GoogleMapHandle, GoogleMapProps, GoogleMapStatus } from './types';
import './google-map.css';

type MapContextValue = {
  adapter: MapAdapter;
  overlayHost: MapOverlayHost;
  canvasRef: RefObject<HTMLDivElement | null>;
};

const MapContext = createContext<MapContextValue | null>(null);

// Custom overlays can use the existing provider-neutral boundaries.
export function useGoogleMap() {
  const map = useContext(MapContext);
  if (!map)
    throw new Error('useGoogleMap must be used inside a ready GoogleMap.');
  return map;
}

export function GoogleMap(props: GoogleMapProps) {
  const {
    ref,
    center,
    zoom,
    mapId,
    options,
    polylines,
    className,
    style,
    ariaLabel = '지도',
    children,
    renderStatus,
  } = props;
  const canvasRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<MapRuntime | null>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [status, setStatus] = useState<GoogleMapStatus>(
    mapsConfig.apiKey ? 'loading' : 'missing-key',
  );
  const handle = useMemo<GoogleMapHandle>(
    () => ({
      panTo: (point, offset) =>
        runtimeRef.current?.adapter.panTo(point, offset),
      setZoom: (value) => runtimeRef.current?.adapter.setZoom(value),
      fitBounds: (bounds, padding) =>
        runtimeRef.current?.adapter.fitBounds(bounds, padding),
    }),
    [],
  );
  useImperativeHandle(ref, () => handle, [handle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setRuntime(null);
    setStatus(mapsConfig.apiKey ? 'loading' : 'missing-key');
    if (!mapsConfig.apiKey) return;
    const controller = new AbortController();
    let ownedRuntime: MapRuntime | null = null;
    const authFailed = () => {
      controller.abort();
      setStatus('error');
      latest.current.onError?.(new Error('Google Maps 인증에 실패했습니다.'));
    };
    window.addEventListener(mapsAuthErrorEvent, authFailed);
    void createGoogleMapRuntime(canvas, controller.signal, {
      center: latest.current.center,
      zoom: latest.current.zoom,
      options: latest.current.options,
      mapId,
    }).then(
      (created) => {
        if (controller.signal.aborted) {
          created.dispose();
          return;
        }
        ownedRuntime = created;
        runtimeRef.current = created;
        setRuntime(created);
        setStatus('ready');
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setStatus('error');
        latest.current.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      },
    );
    return () => {
      controller.abort();
      window.removeEventListener(mapsAuthErrorEvent, authFailed);
      runtimeRef.current = null;
      ownedRuntime?.dispose();
    };
  }, [mapId]);

  useEffect(
    () =>
      runtime?.subscribeEvents({
        onMapClick: (event) => latest.current.onMapClick?.(event),
        onCenterChanged: (point) => latest.current.onCenterChanged?.(point),
        onZoomChanged: (value) => latest.current.onZoomChanged?.(value),
      }),
    [runtime],
  );

  const lat = center?.lat;
  const lng = center?.lng;
  useEffect(() => {
    if (!runtime || lat === undefined || lng === undefined) return;
    const current = runtime.adapter.getCenter();
    if (current?.lat !== lat || current?.lng !== lng)
      runtime.adapter.panTo({ lat, lng });
  }, [runtime, lat, lng]);
  useEffect(() => {
    if (runtime && zoom !== undefined && runtime.adapter.getZoom() !== zoom)
      runtime.adapter.setZoom(zoom);
  }, [runtime, zoom]);
  useEffect(() => {
    if (options) runtime?.setOptions(options);
  }, [runtime, options]);
  useEffect(() => {
    runtime?.setPolylines(polylines ?? []);
  }, [runtime, polylines]);
  useEffect(() => {
    if (runtime) latest.current.onReady?.(handle);
  }, [runtime, handle]);

  const context = useMemo(
    () =>
      runtime
        ? {
            adapter: runtime.adapter,
            overlayHost: runtime.overlayHost,
            canvasRef,
          }
        : null,
    [runtime],
  );

  return (
    <div className={`google-map ${className ?? ''}`} style={style}>
      <div
        ref={canvasRef}
        className="google-map-canvas"
        aria-label={ariaLabel}
      />
      {status !== 'ready' &&
        (renderStatus ? (
          renderStatus(status)
        ) : (
          <div
            className="google-map-status"
            role={status === 'loading' ? 'status' : 'alert'}
          >
            <p>
              {status === 'loading'
                ? '지도를 불러오고 있습니다'
                : status === 'missing-key'
                  ? '지도 연결을 설정해 주세요.'
                  : '지도를 불러올 수 없습니다. 연결을 확인해 주세요.'}
            </p>
            {status === 'error' && (
              <button type="button" onClick={() => window.location.reload()}>
                다시 시도
              </button>
            )}
          </div>
        ))}
      {context && (
        <MapContext.Provider value={context}>{children}</MapContext.Provider>
      )}
    </div>
  );
}
