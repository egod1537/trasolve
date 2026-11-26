import { writeFile } from 'node:fs/promises';

const [, , command, payload = ''] = process.argv;
const targets = await fetch('http://[::1]:9444/json/list').then((response) =>
  response.json(),
);
const target = targets.find(
  (candidate) =>
    candidate.type === 'page' && candidate.url.includes('127.0.0.1:4173'),
);
if (!target?.webSocketDebuggerUrl) {
  throw new Error('Trasolve page target was not found.');
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let requestId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
  else callback.resolve(message.result);
});

function send(method, params = {}) {
  requestId += 1;
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    socket.send(JSON.stringify({ id: requestId, method, params }));
  });
}

await send('Runtime.enable');
await send('Page.enable');

if (command === 'eval') {
  const expression = Buffer.from(payload, 'base64url').toString('utf8');
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(JSON.stringify(result.exceptionDetails));
  }
  process.stdout.write(`${JSON.stringify(result.result.value)}\n`);
} else if (command === 'shot') {
  const outputPath = Buffer.from(payload, 'base64url').toString('utf8');
  const result = await send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(outputPath, Buffer.from(result.data, 'base64'));
  process.stdout.write(`${outputPath}\n`);
} else {
  throw new Error(`Unknown command: ${command}`);
}

socket.close();
