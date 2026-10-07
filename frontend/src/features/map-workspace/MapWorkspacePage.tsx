import { Component, useEffect } from 'react';
import type { Trip } from '@trasolve/shared';
import { GoogleMap } from '@/map/components/GoogleMap';
import { TripPickerPopup } from '@/features/map-workspace/components/TripPickerPopup';
import { TripSession } from '@/features/map-workspace/components/TripSession';
import { demoTrip } from '@/features/map-workspace/data/demoTrip';
import { seoulDemoTrip } from '@/features/map-workspace/data/seoulDemoTrip';
import { tripViewToInput, type Trip as TripView } from '@/entities/trip';
import { HttpTripRepository } from '@/entities/trip';
import type { TripRepository } from '@/entities/trip';
import { selectTripById } from '@/features/map-workspace/model/selectors';
import { type MapWorkspaceMode } from '@/features/map-workspace/model/mapWorkspaceMode';
import '@/features/map-workspace/styles/trip-maps.css';
import { useL, type Localize } from '@/shared/i18n';
import {
  isDebugGuestMode,
  useCurrentUser,
  type CurrentUserState,
} from '@/features/auth';
import { AnalyticsOverlay } from '@/features/analytics-overlay';

type Action = 'opening' | 'creating' | 'deleting';
type OperationErrors = Record<Action, string | null>;
type Props = {
  L: Localize;
  mode: MapWorkspaceMode;
  analyticsMode: boolean;
  authenticationStatus: CurrentUserState['status'];
  authNotice: string | null;
  onLogin: () => void;
};

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

export default function MapWorkspaceFeature({
  mode,
  analyticsMode,
}: {
  mode: MapWorkspaceMode;
  analyticsMode: boolean;
}) {
  const L = useL();
  const { state, login, authNotice } = useCurrentUser();

  useEffect(() => {
    if (state.status === 'signed-out') {
      window.location.replace(
        isDebugGuestMode(window.location.search) ? '/?debug=1' : '/',
      );
    }
  }, [state.status]);

  if (state.status !== 'signed-in') {
    return <p role="status">{L('map:routes.loadingLabel.loadingTravelMap')}</p>;
  }

  return (
    <MapWorkspaceFeatureView
      key={`signed-in:${state.user.id}`}
      L={L}
      mode={mode}
      analyticsMode={analyticsMode}
      authenticationStatus={state.status}
      authNotice={authNotice}
      onLogin={() => void login()}
    />
  );
}

class MapWorkspaceFeatureView extends Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.repository = new HttpTripRepository();
    this.state = {
      selectedTripId: null,
      sessionRevision: 0,
      pickerOpen: true,
      trips: [],
      catalogLoading: props.authenticationStatus !== 'signed-out',
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
    if (this.props.authenticationStatus === 'signed-in') {
      this.refreshTrips();
    }
  }

  public componentWillUnmount(): void {
    this.pendingCatalog?.abort();
    this.pendingCatalog = null;
    this.pendingAction?.abort();
    this.pendingAction = null;
  }

  public render() {
    const {
      L,
      mode,
      analyticsMode,
      authenticationStatus,
      authNotice,
      onLogin,
    } = this.props;
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
    const pickerProps = {
      trips,
      busy:
        authenticationStatus === 'loading' || catalogLoading || action !== null,
      error:
        authNotice ||
        (lastAction ? operationErrors[lastAction] : null) ||
        catalogError,
      authenticationStatus,
      canClose: !!selectedTrip && action === null,
      onClose: this.closePicker,
      onRefresh: this.refreshTrips,
      onOpen: this.openTrip,
      onLogin,
    };

    return (
      <div className="trip-maps-workspace">
        <div inert={showPicker}>
          {selectedTrip ? (
            mode === 'readonly' ? (
              <TripSession
                key={`${selectedTrip.id}:${sessionRevision}`}
                mode="readonly"
                trip={selectedTrip}
              />
            ) : (
              <TripSession
                key={`${selectedTrip.id}:${sessionRevision}`}
                mode="edit"
                trip={selectedTrip}
                repository={this.repository}
                onOpenTripPicker={this.openPicker}
              />
            )
          ) : (
            <main className="trip-map-empty-background">
              <GoogleMap
                ariaLabel={L(
                  'map:mapWorkspacePage.render.ariaLabel.travelSelectionMapBackground',
                )}
                style={{ position: 'absolute', inset: 0, height: '100%' }}
              />
            </main>
          )}
        </div>
        {showPicker &&
          (mode === 'readonly' ? (
            <TripPickerPopup mode="readonly" {...pickerProps} />
          ) : (
            <TripPickerPopup
              mode="edit"
              {...pickerProps}
              onCreate={this.createTrip}
              onCreateSeoulExample={this.createSeoulExampleTrip}
              onCreateTokyoExample={this.createTokyoExampleTrip}
              onDelete={this.deleteTrip}
            />
          ))}
        {analyticsMode ? <AnalyticsOverlay /> : null}
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
                : this.props.L(
                    'map:mapWorkspacePage.text.listCouldNotBeLoaded',
                  ),
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

  private readonly openPicker = (): void => {
    this.setState({ pickerOpen: true });
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
        this.repository.createTrip(
          {
            title: this.props.L('map:mapWorkspacePage.title.newTravel'),
            days: [],
          },
          signal,
        ),
      this.selectTrip,
    );
  };

  private readonly createSeoulExampleTrip = (): void => {
    this.createExampleTrip(seoulDemoTrip);
  };

  private readonly createTokyoExampleTrip = (): void => {
    this.createExampleTrip(demoTrip);
  };

  private createExampleTrip(exampleTrip: TripView): void {
    void this.runAction(
      'creating',
      (signal) =>
        this.repository.createTrip(tripViewToInput(exampleTrip), signal),
      this.selectTrip,
    );
  }

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
                : this.props.L(
                    'map:mapWorkspacePage.runAction.text.travelRequestFailed',
                  ),
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
