import { useEffect, useRef, useState } from 'react';
import type { Trip } from '@trasolve/shared';
import { HttpTripRepository } from '../repository/HttpTripRepository';
import type { TripRepository } from '../repository/TripRepository';
import { GoogleMap } from '../../../map/components/GoogleMap';
import { TripSession } from './TripSession';
import { TripPickerPopup } from './TripPickerPopup';
import { demoTrip } from '../data/demoTrip';
import { tripViewToInput } from '../domain/tripMapping';
import '../styles/trip-maps.css';

type Action = 'opening' | 'creating' | 'deleting';

export function TripWorkspace() {
  const [repository] = useState<TripRepository>(() => new HttpTripRepository());
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const pendingAction = useRef<AbortController | null>(null);
  const showPicker = pickerOpen || !selectedTrip;

  useEffect(() => {
    if (!showPicker) return;
    const abort = new AbortController();
    void repository
      .listTrips(abort.signal)
      .then((result) => {
        if (!abort.signal.aborted) {
          setTrips(result);
          setCatalogError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted)
          setCatalogError(
            cause instanceof Error
              ? cause.message
              : '목록을 불러올 수 없습니다.',
          );
      })
      .finally(() => {
        if (!abort.signal.aborted) setCatalogLoading(false);
      });
    return () => abort.abort();
  }, [repository, showPicker, revision]);

  useEffect(
    () => () => {
      pendingAction.current?.abort();
      pendingAction.current = null;
    },
    [],
  );

  const refresh = () => {
    setCatalogLoading(true);
    setActionError(null);
    setRevision((value) => value + 1);
  };
  const selectTrip = (trip: Trip) => {
    setSelectedTrip(trip);
    // An explicit reload of the same ID also starts a fresh canonical session.
    setSessionRevision((value) => value + 1);
    setPickerOpen(false);
  };

  async function runAction<T>(
    kind: Action,
    operation: (signal: AbortSignal) => Promise<T>,
    onSuccess: (result: T) => void,
  ): Promise<void> {
    if (pendingAction.current) return;
    const abort = new AbortController();
    pendingAction.current = abort;
    setAction(kind);
    setActionError(null);
    try {
      const result = await operation(abort.signal);
      if (!abort.signal.aborted && pendingAction.current === abort)
        onSuccess(result);
    } catch (cause) {
      if (!abort.signal.aborted && pendingAction.current === abort)
        setActionError(
          cause instanceof Error ? cause.message : '여행 요청에 실패했습니다.',
        );
    } finally {
      if (pendingAction.current === abort) {
        pendingAction.current = null;
        setAction(null);
      }
    }
  }

  const deleteTrip = (id: string) => {
    void runAction(
      'deleting',
      (signal) => repository.deleteTrip(id, signal),
      () => {
        if (selectedTrip?.id === id) setSelectedTrip(null);
        setPickerOpen(true);
        refresh();
      },
    );
  };

  return (
    <div className="trip-maps-workspace">
      <div inert={showPicker}>
        {selectedTrip ? (
          <TripSession
            key={selectedTrip.id + ':' + sessionRevision}
            trip={selectedTrip}
            repository={repository}
          />
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
        <TripPickerPopup
          trips={trips}
          busy={catalogLoading || action !== null}
          error={actionError || catalogError}
          canClose={!!selectedTrip && action === null}
          onClose={() => setPickerOpen(false)}
          onRefresh={refresh}
          onOpen={(id) =>
            void runAction(
              'opening',
              (signal) => repository.getTrip(id, signal),
              selectTrip,
            )
          }
          onCreate={() =>
            void runAction(
              'creating',
              (signal) =>
                repository.createTrip({ title: '새 여행', days: [] }, signal),
              selectTrip,
            )
          }
          onCreateExample={() =>
            void runAction(
              'creating',
              (signal) =>
                repository.createTrip(tripViewToInput(demoTrip), signal),
              selectTrip,
            )
          }
          onDelete={deleteTrip}
        />
      )}
    </div>
  );
}
