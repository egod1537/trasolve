import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApiStatus,
  Endpoint,
  IntermediateInput,
} from '@/pages/testbed/components/google-maps/types';
import {
  type DirectionsRequest,
  type DirectionsResult,
  type RouteLocation,
  TravelMode,
} from '@trasolve/shared';
import { DirectionsApiError, getDirections } from '@/shared/api/routes';
import { L } from '@/shared/i18n';

const MAX_INTERMEDIATES = 25;

function resolveEndpoint(endpoint: Endpoint): RouteLocation {
  return (
    endpoint.location ?? {
      type: 'address',
      address: endpoint.text.trim(),
    }
  );
}

export function useDirectionsState(appendLog: (message: string) => void) {
  const requestId = useRef(0);
  const intermediateId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [origin, setOrigin] = useState<Endpoint>({
    text: L('testbed:useDirectionsState.text.message'),
  });
  const [intermediates, setIntermediates] = useState<IntermediateInput[]>([]);
  const [destination, setDestination] = useState<Endpoint>({
    text: L('testbed:useDirectionsState.text.message2'),
  });
  const [travelMode, setTravelMode] = useState<TravelMode>(TravelMode.DRIVING);
  const [alternatives, setAlternatives] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>('idle');
  const [request, setRequest] = useState<DirectionsRequest | null>(null);
  const [result, setResult] = useState<DirectionsResult | null>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [error, setError] = useState<DirectionsApiError | null>(null);
  const pending = apiStatus === 'loading';
  const route = result?.routes[routeIndex];
  const polylines = useMemo(
    () => (route ? [{ id: 'directions-active-route', path: route.path }] : []),
    [route],
  );

  useEffect(
    () => () => {
      requestId.current++;
      controllerRef.current?.abort();
    },
    [],
  );

  const changeOrigin = useCallback((text: string) => setOrigin({ text }), []);
  const changeDestination = useCallback(
    (text: string) => setDestination({ text }),
    [],
  );
  const addIntermediate = useCallback((endpoint: Endpoint = { text: '' }) => {
    setIntermediates((current) => {
      if (current.length >= MAX_INTERMEDIATES) {
        return current;
      }
      return [...current, { id: ++intermediateId.current, endpoint }];
    });
  }, []);
  const changeIntermediate = useCallback((id: number, text: string) => {
    setIntermediates((current) =>
      current.map((intermediate) =>
        intermediate.id === id
          ? { ...intermediate, endpoint: { text } }
          : intermediate,
      ),
    );
  }, []);
  const removeIntermediate = useCallback((id: number) => {
    setIntermediates((current) =>
      current.filter((intermediate) => intermediate.id !== id),
    );
  }, []);
  const findRoute = useCallback(async () => {
    if (pending) {
      return;
    }
    const id = ++requestId.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const intermediateLocations = intermediates
      .map(({ endpoint }) => endpoint)
      .filter((endpoint) => endpoint.text.trim())
      .map(resolveEndpoint);
    const nextRequest: DirectionsRequest = {
      origin: resolveEndpoint(origin),
      ...(intermediateLocations.length > 0
        ? { intermediates: intermediateLocations }
        : {}),
      destination: resolveEndpoint(destination),
      travelMode,
      computeAlternativeRoutes: alternatives,
    };
    setRequest(nextRequest);
    setApiStatus('loading');
    setError(null);
    setResult(null);
    setRouteIndex(0);
    appendLog(
      L(
        'testbed:useDirectionsState.text.requestDirectionsOriginDestinationIntermediatesAlternatives',
        {
          travelMode: travelMode,
          type: nextRequest.origin.type,
          length: intermediateLocations.length,
          alternatives: alternatives,
        },
      ),
    );
    try {
      const response = await getDirections(nextRequest, controller.signal);
      if (id !== requestId.current) {
        return;
      }
      setResult(response);
      setApiStatus('success');
      appendLog(
        L('testbed:useDirectionsState.text.directionsResponseRoutes', {
          length: response.routes.length,
        }),
      );
    } catch (cause) {
      if (id !== requestId.current) {
        return;
      }
      const failure =
        cause instanceof DirectionsApiError
          ? cause
          : new DirectionsApiError(
              0,
              'UNEXPECTED_ERROR',
              cause instanceof Error ? cause.message : String(cause),
            );
      setError(failure);
      setApiStatus('error');
      appendLog(
        L('testbed:useDirectionsState.text.pathfindingFailed', {
          code: failure.code,
          message: failure.message,
        }),
      );
      if (failure.details) {
        const upstream = failure.details.upstream;
        appendLog(
          L('testbed:useDirectionsState.text.googleResponseHttpStatusMessage', {
            httpStatus: upstream.httpStatus,
            value:
              upstream.status ??
              L('testbed:routeResultPanel.routeDebugDetails.text.none'),
          }),
        );
      }
    }
  }, [
    pending,
    origin,
    intermediates,
    destination,
    travelMode,
    alternatives,
    appendLog,
  ]);

  return {
    origin,
    intermediates,
    destination,
    travelMode,
    alternatives,
    pending,
    apiStatus,
    request,
    result,
    routeIndex,
    route,
    polylines,
    error,
    setOrigin,
    setDestination,
    setTravelMode,
    setAlternatives,
    setRouteIndex,
    changeOrigin,
    addIntermediate,
    changeIntermediate,
    removeIntermediate,
    changeDestination,
    canAddIntermediate: intermediates.length < MAX_INTERMEDIATES,
    findRoute,
  };
}
