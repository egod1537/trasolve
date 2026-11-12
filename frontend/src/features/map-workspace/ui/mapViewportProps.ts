import type { ReactNode, RefObject } from 'react';
import type {
  PlaceDetails,
  PlaceStyle,
  TripPolylineMode,
} from '@trasolve/shared';
import type { SelectedGooglePlace } from '@/entities/place';
import type { GoogleMapHandle } from '@/map/types/googleMapComponent';
import type {
  RouteComparisonData,
  RouteComparisonMode,
  RouteComparisonView,
} from '@/features/route-optimization';
import type {
  MapDetailSelection,
  MapSelectionActions,
  TripMapView,
} from '../model/mapViewportTypes';
import type { Measurement } from '../measurement/useMeasurement';

export type MapCanvasProps = TripMapView &
  MapSelectionActions & {
    sidebarRef: RefObject<HTMLElement | null>;
    measurement?: Measurement;
    comparison?: RouteComparisonData;
    comparisonMode?: RouteComparisonMode;
    comparisonSidebarRef?: RefObject<HTMLElement | null>;
    mapRef?: RefObject<GoogleMapHandle | null>;
    overlay?: ReactNode;
  };

export type MapWorkspaceViewportProps = Omit<
  MapCanvasProps,
  'mapRef' | 'overlay' | 'comparison' | 'comparisonMode'
> &
  MapDetailSelection & {
    comparison: RouteComparisonView | null;
    onCompare: (data: RouteComparisonData | null) => void;
    selectedGooglePlace: SelectedGooglePlace;
    onSelectSearchedGooglePlace: (place: PlaceDetails) => void;
    onCloseGooglePlace: () => void;
    onRetryGooglePlace: () => void;
    onAddGooglePlace: (dayId: string, place: PlaceDetails) => Promise<boolean>;
    selectedPlaceIds: ReadonlySet<string>;
    selectedPolylineIds: ReadonlySet<string>;
    selectedItemCount: number;
    tripMutationBusy: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onCloseTripPlace: () => void;
    onUpdateTripPlaceVisitTimeRange: (
      placeId: string,
      time: string,
      visitDurationMinutes: number,
    ) => Promise<boolean>;
    onUpdateTripPlacePreferredDuration: (
      placeId: string,
      preferredDurationMinutes: number,
    ) => Promise<boolean>;
    onUpdateTripPlaceMemo: (placeId: string, memo: string) => Promise<boolean>;
    onRenameTripPlace: (placeId: string, name: string) => Promise<boolean>;
    onUpdateTripPlaceStyle: (placeId: string, style: PlaceStyle) => void;
    onRemoveTripPlace: (placeId: string) => Promise<boolean>;
    onCloseTripPolyline: () => void;
    onUpdateTripPolylineMode: (
      polylineId: string,
      mode: TripPolylineMode,
    ) => Promise<boolean>;
    onUpdateSelectedPolylineModes: (
      polylineIds: readonly string[],
      mode: TripPolylineMode,
    ) => Promise<boolean>;
    onRemoveSelectedPlaces: (placeIds: readonly string[]) => Promise<boolean>;
    onClearSelection: () => void;
    onOpenTripPicker: () => void;
  };
