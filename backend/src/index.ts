import { createServer, type ServerResponse } from 'node:http';
import {
  API_ROUTES,
  type ApiErrorResponse,
  type HealthResponse,
} from '@trasolve/shared';
import { GoogleOAuthHttpFlow } from './googleOAuthHttp.js';
import { API } from './instances.js';

const port = Number(process.env.PORT ?? 43127);
const host = process.env.HOST ?? '127.0.0.1';
const googleOAuthHttpFlow = new GoogleOAuthHttpFlow();

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  const { pathname } = requestUrl;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (
    pathname === API_ROUTES.trips ||
    pathname.startsWith(`${API_ROUTES.trips}/`)
  ) {
    void API.TripHttp.handle(
      request,
      response,
      pathname === API_ROUTES.trips
        ? undefined
        : pathname.slice(API_ROUTES.trips.length + 1),
    );
    return;
  }

  if (pathname === API_ROUTES.chat) {
    void API.Chat.handle(request, response);
    return;
  }

  if (pathname === API_ROUTES.openWebUIModels) {
    void API.OpenWebUIModels.handle(request, response);
    return;
  }

  if (pathname === API_ROUTES.placesAutocomplete) {
    void API.Place.handleAutocomplete(request, response);
    return;
  }

  if (
    pathname === API_ROUTES.places ||
    pathname.startsWith(`${API_ROUTES.places}/`)
  ) {
    void API.Place.handlePlace(
      request,
      response,
      pathname.slice(API_ROUTES.places.length + 1),
    );
    return;
  }

  if (pathname === API_ROUTES.routes) {
    void API.Route.handle(request, response);
    return;
  }

  if (
    pathname === API_ROUTES.googleOAuthStart ||
    pathname === API_ROUTES.googleOAuthCallback ||
    pathname === API_ROUTES.googleOAuthResult
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
server.requestTimeout = 10000;

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

server.listen(port, host, () => {
  console.log(`Backend: http://${host}:${port}`);
});
