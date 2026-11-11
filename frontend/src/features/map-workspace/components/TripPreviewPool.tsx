import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap } from '@/map/components/GoogleMap';
import {
  createTripPreviewPool,
  type TripPreviewPoolModel,
  type TripPreviewSlot,
} from '../model/tripPreviewPool';
import { PREVIEW_OPTIONS, TripPreviewContents } from './TripPreviewContents';

const PoolContext = createContext<TripPreviewPoolModel | null>(null);

export function useTripPreviewPool() {
  const pool = useContext(PoolContext);
  if (!pool) {
    throw new Error('TripMapPreview requires TripPreviewPool.');
  }
  return pool;
}

function PreviewSlot({ slot }: { slot: TripPreviewSlot }) {
  const [host] = useState(() => {
    const element = document.createElement('div');
    element.className = 'trip-map-picker-preview-host';
    return element;
  });
  useLayoutEffect(() => {
    slot.target?.append(host);
    return () => host.remove();
  }, [host, slot.target]);

  // The portal container never changes. Reparenting its host preserves the SDK
  // instance; leaving the viewport removes markers, lines and resize observers.
  return createPortal(
    <GoogleMap
      className="trip-map-picker-preview-map"
      options={PREVIEW_OPTIONS}
    >
      {slot.target && <TripPreviewContents trip={slot.trip} />}
    </GoogleMap>,
    host,
  );
}

export function TripPreviewPool({ children }: { children: ReactNode }) {
  const [pool] = useState(createTripPreviewPool);
  const slots = useSyncExternalStore(pool.subscribe, pool.getSnapshot);
  useEffect(() => pool.start(), [pool]);
  return (
    <PoolContext.Provider value={pool}>
      {children}
      {slots.map((slot) => (
        <PreviewSlot key={slot.id} slot={slot} />
      ))}
    </PoolContext.Provider>
  );
}
