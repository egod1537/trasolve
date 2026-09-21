import { Component } from 'react';
import type { Trip } from '@trasolve/shared';
import { GoogleMap } from '@/map/components/GoogleMap';
import { TripPickerPopup } from '@/features/map-workspace/components/TripPickerPopup';
import { TripSession } from '@/features/map-workspace/components/TripSession';
import { demoTrip } from '@/features/map-workspace/data/demoTrip';
import { tripViewToInput } from '@/entities/trip';
import { HttpTripRepository } from '@/entities/trip';
import type { TripRepository } from '@/entities/trip';
import { selectTripById } from '@/features/map-workspace/model/selectors';
import '@/features/map-workspace/styles/trip-maps.css';

type Action = 'opening' | 'creating' | 'deleting';
type OperationErrors = Record<Action, string | null>;

type State = {
  selectedTripId: string | null;
  sessionRevision: number;
  pickerOpen: boolean;
  trips: Trip[];
  catalogLoading: boolean;
  catalogError: string | null;
  action: Action | null;
  lastAction: Action | null;
  operationErrors: OperationErrors;
};

export default class MapWorkspaceFeature extends Component<
  Record<string, never>,
  State
> {
  public constructor(props: Record<string, never>) {
    super(props);
    this.repository = new HttpTripRepository();
    this.state = {
      selectedTripId: null,
      sessionRevision: 0,
      pickerOpen: true,
      trips: [],
      catalogLoading: true,
      catalogError: null,
      action: null,
      lastAction: null,
      operationErrors: {
        opening: null,
        creating: null,
        deleting: null,
      },
    };
  }

  public componentDidMount(): void {
    this.refreshTrips();
  }

  public componentWillUnmount(): void {
    this.pendingCatalog?.abort();
    this.pendingCatalog = null;
    this.pendingAction?.abort();
    this.pendingAction = null;
  }

  public render() {
    const {
      selectedTripId,
      sessionRevision,
      pickerOpen,
      trips,
      catalogLoading,
      catalogError,
      action,
      lastAction,
      operationErrors,
    } = this.state;
    const selectedTrip = selectTripById(trips, selectedTripId);
    const showPicker = pickerOpen || !selectedTrip;

    return (
      <div className="trip-maps-workspace">
        <div inert={showPicker}>
          {selectedTrip ? (
            <TripSession
              key={`${selectedTrip.id}:${sessionRevision}`}
              trip={selectedTrip}
              repository={this.repository}
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
            error={
              (lastAction ? operationErrors[lastAction] : null) || catalogError
            }
            canClose={!!selectedTrip && action === null}
            onClose={this.closePicker}
            onRefresh={this.refreshTrips}
            onOpen={this.openTrip}
            onCreate={this.createTrip}
            onCreateExample={this.createExampleTrip}
            onDelete={this.deleteTrip}
          />
        )}
      </div>
    );
  }

  private readonly repository: TripRepository;
  private pendingCatalog: AbortController | null = null;
  private pendingAction: AbortController | null = null;

  private readonly refreshTrips = (): void => {
    this.pendingCatalog?.abort();
    const abort = new AbortController();
    this.pendingCatalog = abort;
    this.setState({ catalogLoading: true });
    void this.repository
      .listTrips(abort.signal)
      .then((trips) => {
        if (!abort.signal.aborted && this.pendingCatalog === abort) {
          this.setState({ trips, catalogError: null });
        }
      })
      .catch((cause: unknown) => {
        if (!abort.signal.aborted && this.pendingCatalog === abort) {
          this.setState({
            catalogError:
              cause instanceof Error
                ? cause.message
                : '목록을 불러올 수 없습니다.',
          });
        }
      })
      .finally(() => {
        if (this.pendingCatalog === abort) {
          this.pendingCatalog = null;
          this.setState({ catalogLoading: false });
        }
      });
  };

  private readonly selectTrip = (selectedTrip: Trip): void => {
    this.setState((state) => ({
      selectedTripId: selectedTrip.id,
      trips: [
        selectedTrip,
        ...state.trips.filter((trip) => trip.id !== selectedTrip.id),
      ],
      sessionRevision: state.sessionRevision + 1,
      pickerOpen: false,
    }));
  };

  private readonly closePicker = (): void => {
    this.setState({ pickerOpen: false });
  };

  private readonly openTrip = (id: string): void => {
    void this.runAction(
      'opening',
      (signal) => this.repository.getTrip(id, signal),
      this.selectTrip,
    );
  };

  private readonly createTrip = (): void => {
    void this.runAction(
      'creating',
      (signal) =>
        this.repository.createTrip({ title: '새 여행', days: [] }, signal),
      this.selectTrip,
    );
  };

  private readonly createExampleTrip = (): void => {
    void this.runAction(
      'creating',
      (signal) => this.repository.createTrip(tripViewToInput(demoTrip), signal),
      this.selectTrip,
    );
  };

  private readonly deleteTrip = (id: string): void => {
    void this.runAction(
      'deleting',
      (signal) => this.repository.deleteTrip(id, signal),
      () => {
        this.setState((state) => ({
          selectedTripId:
            state.selectedTripId === id ? null : state.selectedTripId,
          pickerOpen: true,
        }));
        this.refreshTrips();
      },
    );
  };

  private async runAction<T>(
    action: Action,
    operation: (signal: AbortSignal) => Promise<T>,
    onSuccess: (result: T) => void,
  ): Promise<void> {
    if (this.pendingAction) {
      return;
    }
    const abort = new AbortController();
    this.pendingAction = abort;
    this.setState((state) => ({
      action,
      lastAction: action,
      operationErrors: { ...state.operationErrors, [action]: null },
    }));
    try {
      const result = await operation(abort.signal);
      if (!abort.signal.aborted && this.pendingAction === abort) {
        onSuccess(result);
      }
    } catch (cause) {
      if (!abort.signal.aborted && this.pendingAction === abort) {
        this.setState((state) => ({
          operationErrors: {
            ...state.operationErrors,
            [action]:
              cause instanceof Error
                ? cause.message
                : '여행 요청에 실패했습니다.',
          },
        }));
      }
    } finally {
      if (this.pendingAction === abort) {
        this.pendingAction = null;
        this.setState({ action: null });
      }
    }
  }
}
