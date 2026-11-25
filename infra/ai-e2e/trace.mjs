import {
  API_ROUTES,
  chatStreamEventSchema,
  readSseData,
} from '@trasolve/shared';

export async function observeTraffic(tab, origin) {
  const requests = new Map();
  const tripWrites = [];
  const diagnostics = [];
  const diagnosticReads = [];
  let observerError;
  const tripPattern = new URL(API_ROUTES.trips, origin).href;

  tab.on('Runtime.consoleAPICalled', ({ args }) => {
    if (
      args[0]?.value !== 'trip_plan_prepare' ||
      !args[1]?.objectId ||
      diagnosticReads.length >= 64
    )
      return;
    const read = tab
      .send('Runtime.callFunctionOn', {
        objectId: args[1].objectId,
        functionDeclaration: 'function () { return this; }',
        returnByValue: true,
      })
      .then(({ result }) => {
        if (result.value && diagnostics.length < 64)
          diagnostics.push(result.value);
      })
      .catch((error) => {
        observerError ??= error.message;
      });
    diagnosticReads.push(read);
  });
  tab.on('Fetch.requestPaused', ({ request, requestId }) => {
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if (!read) {
      tripWrites.push({
        method: request.method,
        path: new URL(request.url).pathname,
      });
    }
    void tab
      .send(read ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
        requestId,
        ...(read ? {} : { errorReason: 'BlockedByClient' }),
      })
      .catch((error) => {
        observerError ??= error.message;
      });
  });

  tab.on('Network.requestWillBeSent', ({ request, requestId, timestamp }) => {
    const url = new URL(request.url);
    if (url.origin !== origin.origin) return;
    const path = url.pathname;
    const chat = path === API_ROUTES.chatStream && request.method === 'POST';
    const places =
      path === API_ROUTES.places || path.startsWith(`${API_ROUTES.places}/`);
    if (chat || places) {
      requests.set(requestId, {
        kind: chat ? 'chat' : 'places',
        path,
        method: request.method,
        start: timestamp,
        ...(chat
          ? {
              requestId: Object.entries(request.headers).find(
                ([name]) => name.toLowerCase() === 'x-trasolve-request-id',
              )?.[1],
              ...requestMetadata(request.postData),
            }
          : {}),
      });
    }
  });
  tab.on('Network.responseReceived', ({ requestId, response, timestamp }) => {
    const request = requests.get(requestId);
    if (!request) return;
    request.status = response.status;
    request.headersMs = duration(request, timestamp);
    if (request.kind === 'chat' && response.status === 200) {
      request.chunks = [];
      request.streaming = tab
        .send('Network.streamResourceContent', { requestId })
        .then(({ bufferedData }) => {
          if (bufferedData) request.chunks.unshift(bufferedData);
        })
        .catch(() => {
          request.chunks = null;
        });
    }
  });
  tab.on('Network.dataReceived', ({ requestId, data, timestamp }) => {
    const request = requests.get(requestId);
    if (request?.chunks && data) {
      request.firstStreamChunkMs ??= duration(request, timestamp);
      request.chunks.push(data);
    }
  });
  tab.on('Network.loadingFinished', ({ requestId, timestamp }) =>
    finish(requestId, timestamp),
  );
  tab.on('Network.loadingFailed', ({ requestId, timestamp, errorText }) => {
    finish(requestId, timestamp, errorText);
  });

  function finish(requestId, timestamp, transportError) {
    const request = requests.get(requestId);
    if (!request) return;
    request.elapsedMs = duration(request, timestamp);
    if (transportError) request.transportError = transportError;
  }

  await tab.send('Network.enable', {
    maxTotalBufferSize: 8_000_000,
    maxResourceBufferSize: 4_000_000,
    maxPostDataSize: 512_000,
  });
  await tab.send('Runtime.enable');
  await tab.send('Network.setBypassServiceWorker', { bypass: true });
  await tab.send('Fetch.enable', {
    patterns: [{ urlPattern: `${tripPattern}*`, requestStage: 'Request' }],
  });

  return {
    tripWrites,
    diagnostics,
    get observerError() {
      return observerError;
    },
    get finishedChatCount() {
      return [...requests.values()].filter(
        (r) => r.kind === 'chat' && r.elapsedMs !== undefined,
      ).length;
    },
    async collect() {
      await Promise.all(diagnosticReads);
      return Promise.all(
        [...requests].map(async ([id, request]) => {
          await request.streaming;
          const {
            chunks,
            streaming: _streaming,
            start: _start,
            ...record
          } = request;
          if (record.kind !== 'chat' || record.status === undefined)
            return record;
          try {
            const fallback = chunks?.length
              ? null
              : await tab.send('Network.getResponseBody', { requestId: id });
            const bytes = fallback
              ? Buffer.from(
                  fallback.body,
                  fallback.base64Encoded ? 'base64' : 'utf8',
                )
              : Buffer.concat(
                  chunks.map((chunk) => Buffer.from(chunk, 'base64')),
                );
            Object.assign(record, await summarizeChat(record.status, bytes));
            const terminal = record.events?.at(-1)?.type;
            if (
              ['complete', 'error'].includes(terminal) &&
              record.transportError === 'net::ERR_ABORTED'
            ) {
              // The app cancels its reader after accepting a terminal frame.
              record.clientClosedAfterTerminal = true;
              delete record.transportError;
            }
          } catch (error) {
            record.readError = error.message;
          }
          return record;
        }),
      );
    },
  };
}

function duration(request, timestamp) {
  return Math.round((timestamp - request.start) * 1000);
}

function requestMetadata(postData) {
  try {
    const { model, tools } = JSON.parse(postData);
    return { requestedModel: model, offeredTools: tools ?? [] };
  } catch {
    return {};
  }
}

async function summarizeChat(status, bytes) {
  if (status !== 200) {
    try {
      return { code: JSON.parse(bytes.toString()).error?.code };
    } catch {
      return {};
    }
  }
  const stream = new Blob([bytes]).stream();
  const events = [];
  try {
    for await (const data of readSseData(stream, new TextDecoder())) {
      const event = chatStreamEventSchema.parse(JSON.parse(data));
      events.push(
        event.type === 'status'
          ? { type: event.type, stage: event.stage }
          : { type: event.type },
      );
      if (event.type === 'complete') return { events, response: event.result };
      if (event.type === 'error') return { events, code: event.code };
    }
    return { events, code: 'SSE_MISSING_TERMINAL' };
  } catch {
    return { events, code: 'SSE_INVALID' };
  }
}
