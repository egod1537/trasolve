import { useEffect, useState } from 'react';
import type { TripMap } from '@trasolve/shared';
import { listTrips } from '../../api/trips';
import {
  useTripMapController,
  useTripMapState,
} from '../../hooks/map/useTripMap';
import { GoogleMap } from '../google-map/GoogleMap';
import { MapWorkspace } from './MapWorkspace';
import { TripMapPickerDialog } from './TripMapPickerDialog';
import { demoTrip } from '../../data/demoTrip';
import { tripViewToInput } from '../../domain/map/tripMapMapping';
import '../../styles/trip-maps.css';

export function TripMapsWorkspace() {
  const { tripMap, status, error } = useTripMapState();
  const controller = useTripMapController();
  const [pickerOpen, setPickerOpen] = useState(true);
  const [trips, setTrips] = useState<TripMap[]>([]);
  const [pending, setPending] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const showPicker = pickerOpen || !tripMap;

  useEffect(() => {
    if (!showPicker) return;
    const abort = new AbortController();
    void listTrips(abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setTrips(result);
          setListError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted)
          setListError(
            cause instanceof Error
              ? cause.message
              : '목록을 불러올 수 없습니다.',
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setPending(false);
      });
    return () => abort.abort();
  }, [showPicker, revision]);

  const refresh = () => {
    setPending(true);
    setRevision((value) => value + 1);
  };
  const selectTrip = async (command: Promise<boolean>) => {
    if (await command) setPickerOpen(false);
  };

  return (
    <div className="trip-maps-workspace">
      <div inert={showPicker}>
        {tripMap ? (
          <MapWorkspace key={tripMap.id} trip={tripMap} />
        ) : (
          <main className="trip-map-empty-background">
            <GoogleMap
              ariaLabel="여행 선택 지도 배경"
              style={{ position: 'absolute', inset: 0, height: '100%' }}
            />
          </main>
        )}
      </div>
      {showPicker && (
        <TripMapPickerDialog
          trips={trips}
          busy={pending || status === 'loading' || status === 'saving'}
          error={error || listError}
          canClose={!!tripMap}
          onClose={() => setPickerOpen(false)}
          onRefresh={refresh}
          onOpen={(id) => void selectTrip(controller.loadTrip(id))}
          onCreate={() =>
            void selectTrip(
              controller.createTrip({ title: '새 여행', days: [] }),
            )
          }
          onCreateExample={() =>
            void selectTrip(controller.createTrip(tripViewToInput(demoTrip)))
          }
        />
      )}
    </div>
  );
}
