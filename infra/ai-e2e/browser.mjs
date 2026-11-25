import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';

export function isLoopback(url) {
  return (
    url.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    !url.username &&
    !url.password
  );
}

export async function openBrowserTab(debugOrigin) {
  const response = await fetch(new URL('/json/new?about:blank', debugOrigin), {
    method: 'PUT',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
  const target = await response.json();
  const endpoint = new URL(target.webSocketDebuggerUrl);
  // Chrome may canonicalize localhost to a loopback IP.
  if (
    !isLoopback(new URL(endpoint.href.replace(/^ws:/, 'http:'))) ||
    endpoint.port !== debugOrigin.port
  ) {
    throw new Error('Invalid CDP WebSocket endpoint');
  }
  const socket = new WebSocket(endpoint);
  const events = new Map();
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const call = pending.get(message.id);
      if (call) {
        pending.delete(message.id);
        call(message);
      }
    } else {
      events.get(message.method)?.(message.params);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 10000);
      pending.set(id, ({ result, error }) => {
        clearTimeout(timer);
        if (error) reject(new Error(`${method}: ${error.message}`));
        else resolve(result);
      });
      try {
        socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  async function close() {
    if (socket.readyState === WebSocket.OPEN) socket.close();
    const result = await fetch(
      new URL(`/json/close/${target.id}`, debugOrigin),
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!result.ok) throw new Error(`Tab cleanup HTTP ${result.status}`);
  }

  try {
    await once(socket, 'open', { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    await close().catch(() => {});
    throw error;
  }

  return {
    send,
    close,
    on: (event, listener) => events.set(event, listener),
    async evaluate(fn, ...args) {
      const { exceptionDetails, result } = await send('Runtime.evaluate', {
        expression: `(${fn})(...${JSON.stringify(args)})`,
        awaitPromise: true,
        returnByValue: true,
      });
      if (exceptionDetails) {
        throw new Error(
          exceptionDetails.exception?.description ?? exceptionDetails.text,
        );
      }
      return result.value;
    },
  };
}

export async function until(check, timeoutMs, errorCode) {
  const deadline = performance.now() + timeoutMs;
  do {
    const value = await check();
    if (value) return value;
    await sleep(100);
  } while (performance.now() < deadline);

  throw Object.assign(new Error(errorCode), { code: errorCode });
}
