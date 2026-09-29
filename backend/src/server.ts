import { createServer, type Server, type ServerResponse } from 'node:http';
import {
  API_ROUTE_SUFFIXES,
  API_ROUTES,
  type ApiErrorResponse,
  type HealthResponse,
} from '@trasolve/shared';
import type { GoogleOAuthHttpFlow } from './googleOAuthHttp.js';
import type { API } from './instances.js';
import type { TripHttpService } from './trip/tripHttpService.js';
import type { TripShareHttpService } from './trip-sharing/tripShareHttpService.js';
import type { TripPreviewHttpService } from './trip-preview/tripPreviewHttpService.js';
import type { AnalyticsEventHttpService } from './analytics/analyticsEventHttpService.js';
import type { AnalyticsQueryHttpService } from './analytics/analyticsQueryHttpService.js';

export function createBackendServer(
  api: typeof API,
  googleOAuthHttpFlow: GoogleOAuthHttpFlow,
  tripHttp: TripHttpService,
  tripShareHttp: TripShareHttpService,
  tripPreviewHttp: TripPreviewHttpService,
  analyticsEventHttp: AnalyticsEventHttpService,
  analyticsQueryHttp: AnalyticsQueryHttpService,
): Server {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');
    const { pathname } = requestUrl;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (pathname === API_ROUTES.analyticsEvents) {
      void analyticsEventHttp.handle(request, response);
      return;
    }

    if (pathname === API_ROUTES.analyticsFlows) {
      void analyticsQueryHttp.handleFlows(request, response, requestUrl);
      return;
    }

    if (pathname === API_ROUTES.analyticsFunnels) {
      void analyticsQueryHttp.handleFunnels(request, response, requestUrl);
      return;
    }

    const analyticsFunnelId = matchSinglePathSegment(
      pathname,
      `${API_ROUTES.analyticsFunnels}/`,
    );
    if (analyticsFunnelId !== null) {
      void analyticsQueryHttp.handleFunnelResult(
        request,
        response,
        requestUrl,
        analyticsFunnelId,
      );
      return;
    }

    if (pathname === API_ROUTES.analyticsOverview) {
      void analyticsQueryHttp.handleOverview(request, response, requestUrl);
      return;
    }

    if (pathname === API_ROUTES.analyticsSessions) {
      void analyticsQueryHttp.handleSessions(request, response, requestUrl);
      return;
    }

    const analyticsSessionId = matchSinglePathSegment(
      pathname,
      `${API_ROUTES.analyticsSessions}/`,
      '/events',
    );
    if (analyticsSessionId !== null) {
      void analyticsQueryHttp.handleSessionEvents(
        request,
        response,
        requestUrl,
        analyticsSessionId,
      );
      return;
    }

    const tripShareId = matchSinglePathSegment(
      pathname,
      `${API_ROUTES.trips}/`,
      API_ROUTE_SUFFIXES.tripShare,
    );
    if (tripShareId !== null) {
      void tripShareHttp.handleOwner(request, response, tripShareId);
      return;
    }

    const tripPreviewId = matchSinglePathSegment(
      pathname,
      `${API_ROUTES.trips}/`,
      API_ROUTE_SUFFIXES.tripPreview,
    );
    if (tripPreviewId !== null) {
      void tripPreviewHttp.handle(request, response, tripPreviewId);
      return;
    }

    const sharedTripToken = matchSinglePathSegment(
      pathname,
      `${API_ROUTES.sharedTrips}/`,
    );
    if (sharedTripToken !== null) {
      void tripShareHttp.handlePublic(request, response, sharedTripToken);
      return;
    }

    if (
      pathname === API_ROUTES.trips ||
      pathname.startsWith(`${API_ROUTES.trips}/`)
    ) {
      void tripHttp.handle(
        request,
        response,
        pathname === API_ROUTES.trips
          ? undefined
          : pathname.slice(API_ROUTES.trips.length + 1),
      );
      return;
    }

    if (pathname === API_ROUTES.chat) {
      void api.Chat.handle(request, response);
      return;
    }

    if (pathname === API_ROUTES.openWebUIModels) {
      void api.OpenWebUIModels.handle(request, response);
      return;
    }

    if (pathname === API_ROUTES.placesAutocomplete) {
      void api.Place.handleAutocomplete(request, response);
      return;
    }

    if (
      pathname === API_ROUTES.tcacheInternalHealth ||
      pathname === API_ROUTES.tcacheInternalJobs ||
      pathname.startsWith(`${API_ROUTES.tcacheInternalJobs}/`)
    ) {
      void api.TcacheJobHttp.handle(request, response, pathname);
      return;
    }

    if (
      pathname === API_ROUTES.places ||
      pathname.startsWith(`${API_ROUTES.places}/`)
    ) {
      void api.Place.handlePlace(
        request,
        response,
        pathname.slice(API_ROUTES.places.length + 1),
      );
      return;
    }

    if (pathname === API_ROUTES.routes) {
      void api.Route.handle(request, response);
      return;
    }

    if (pathname === API_ROUTES.trouteOptimize) {
      void api.TrouteHttp.handle(request, response);
      return;
    }

    if (
      pathname === API_ROUTES.trouteInternalHealth ||
      pathname === API_ROUTES.trouteInternalJobs ||
      pathname.startsWith(`${API_ROUTES.trouteInternalJobs}/`)
    ) {
      void api.TrouteJobHttp.handle(request, response, pathname);
      return;
    }

    if (
      pathname === API_ROUTES.googleOAuthStart ||
      pathname === API_ROUTES.googleOAuthCallback ||
      pathname === API_ROUTES.googleOAuthResult ||
      pathname === API_ROUTES.authLocalLogin ||
      pathname === API_ROUTES.authMe ||
      pathname === API_ROUTES.authLogout
    ) {
      void googleOAuthHttpFlow
        .handle(request, response, requestUrl)
        .catch(() => sendOAuthInternalError(response));
      return;
    }

    if (request.method === 'GET' && pathname === API_ROUTES.health) {
      const body: HealthResponse = { status: 'ok' };
      response.writeHead(200);
      response.end(JSON.stringify(body));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: 'Not found' }));
  });
  server.requestTimeout = 35000;
  return server;
}

function matchSinglePathSegment(
  pathname: string,
  prefix: string,
  suffix = '',
): string | null {
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return null;
  }
  const segment = pathname.slice(
    prefix.length,
    suffix.length === 0 ? undefined : -suffix.length,
  );
  return segment.length > 0 && !segment.includes('/') ? segment : null;
}

function sendOAuthInternalError(response: ServerResponse): void {
  if (response.headersSent) {
    response.end();
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  const body: ApiErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'OAuth 요청을 처리할 수 없습니다.',
    },
  };
  response.writeHead(500);
  response.end(JSON.stringify(body));
}
