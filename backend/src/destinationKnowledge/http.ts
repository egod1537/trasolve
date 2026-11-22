import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import {
  AuthenticationRequiredError,
  type CurrentUserResolver,
} from '../auth/currentUserResolver.js';
import {
  destinationKnowledgeSearchSchema,
  getDestinationKnowledge,
  searchDestinationKnowledge,
} from './index.js';
import { destinationIdSchema } from './snapshot.js';

export async function handleDestinationKnowledge(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  currentUser: CurrentUserResolver,
  destinationId: string | null,
): Promise<void> {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    sendError(response, 405, 'METHOD_NOT_ALLOWED');
    return;
  }

  try {
    await currentUser.require(request);
  } catch (cause) {
    if (cause instanceof AuthenticationRequiredError) {
      sendError(response, 401, 'AUTHENTICATION_REQUIRED');
    } else {
      sendError(response, 503, 'STORAGE_UNAVAILABLE');
    }
    return;
  }

  try {
    if (destinationId === null) {
      const params = Object.fromEntries(url.searchParams);
      if (Object.keys(params).length !== url.searchParams.size) {
        sendError(response, 400, 'INVALID_DESTINATION_QUERY');
        return;
      }
      const limit = params.limit;
      const query = destinationKnowledgeSearchSchema.parse({
        ...params,
        limit:
          limit !== undefined && /^\d{1,2}$/.test(limit)
            ? Number(limit)
            : limit,
      });
      sendJson(response, 200, searchDestinationKnowledge(query));
      return;
    }
    if (url.searchParams.size !== 0) {
      sendError(response, 400, 'INVALID_DESTINATION_QUERY');
      return;
    }
    const lookup = getDestinationKnowledge(
      destinationIdSchema.parse(decodeURIComponent(destinationId)),
    );
    if (!lookup.item) {
      sendError(response, 404, 'DESTINATION_NOT_FOUND');
      return;
    }
    sendJson(response, 200, lookup);
  } catch (cause) {
    if (cause instanceof z.ZodError || cause instanceof URIError) {
      sendError(response, 400, 'INVALID_DESTINATION_QUERY');
    } else {
      sendError(response, 500, 'INTERNAL_ERROR');
    }
  }
}

function sendError(
  response: ServerResponse,
  status: number,
  code: string,
): void {
  sendJson(response, status, { error: { code } });
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  if (response.destroyed) {
    return;
  }
  response.writeHead(status);
  response.end(JSON.stringify(body));
}
