import { createServer } from 'node:http';
import { API_ROUTES, type HealthResponse } from '@trasolve/shared';
import { API } from './instances.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (pathname === API_ROUTES.routes) {
    void API.Route.handle(request, response);
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

server.listen(port, host, () => {
  console.log(`Backend: http://${host}:${port}`);
});
