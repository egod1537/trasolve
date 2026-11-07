import http from 'node:http';

// Adapted from S3 r18/stub2.cjs and proxy.cjs (2026-11-06): same Gemini wire
// contract and response-loss/412 injection, with ephemeral loopback ports.
export async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw;
}
function send(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}
function context(b) {
  const s = (b.systemInstruction?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('\n\n');
  const i = s.indexOf('{"trip"');
  return i < 0 ? null : JSON.parse(s.slice(i).trim().split('\n\n')[0]);
}
function resolveTokens(value, c) {
  const table = Array.isArray(c.places[0]);
  const names = table
    ? c.places
        .slice(1)
        .map((r) => [r[c.places[0].indexOf('name')], c.ids[r[0]]])
    : c.places.map((p) => [p.name, p.id]);
  const days = table
    ? c.days.slice(1).map((r) => c.ids[r[0]])
    : c.days.map((d) => d.id);
  if (typeof value === 'string' && value.startsWith('@place:'))
    return {
      kind: 'id',
      id: new Map(names).get(value.slice(7)) ?? 'missing-place',
    };
  if (typeof value === 'string' && value.startsWith('@day:'))
    return { kind: 'id', id: days[Number(value.slice(5)) - 1] };
  if (Array.isArray(value)) return value.map((v) => resolveTokens(v, c));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveTokens(v, c)]),
    );
  return value;
}
export function stubServer(state) {
  return http.createServer(async (req, res) => {
    const started = performance.now();
    try {
      if (!/^\/(?:v1(?:beta)?\/)?models\/[^/]+:generateContent$/.test(req.url))
        return send(res, 404, {});
      const b = JSON.parse(await body(req));
      const c = context(b);
      const spec = state.spec;
      if (spec.status) {
        state.provider.push({
          model: 's3-mock',
          mode: 'ERROR',
          toolName: null,
          status: spec.status,
          elapsedMs: performance.now() - started,
        });
        return send(res, spec.status, {
          error: { message: 'Controlled S3 provider failure' },
        });
      }
      const plan = {
        version: 1,
        base: { tripId: c.trip.tripId, fingerprint: c.trip.fingerprint },
        operations: resolveTokens(
          spec.ops.map((op, i) => ({ stepId: `s${i + 1}`, ...op })),
          c,
        ),
      };
      const native = spec.mode === 'native';
      const part = native
        ? { functionCall: { name: 'propose_trip_command_plan', args: plan } }
        : { text: JSON.stringify(plan) };
      // Only fixed fixture input/output is retained. Never serialize headers/env.
      state.provider.push({
        mode: native ? 'NATIVE_TOOL' : 'JSON_PLAN',
        model: 's3-mock',
        toolsAdvertised: !!b.tools,
        toolName: native ? 'propose_trip_command_plan' : null,
        plan,
        status: 200,
        elapsedMs: performance.now() - started,
      });
      send(res, 200, {
        candidates: [
          { content: { role: 'model', parts: [part] }, finishReason: 'STOP' },
        ],
      });
    } catch {
      send(res, 500, { error: { message: 'S3 fixture context unavailable' } });
    }
  });
}
export function proxyServer(backend, state) {
  return http.createServer(async (req, res) => {
    const started = performance.now();
    const method = req.method;
    const path = req.url;
    const event = {
      method,
      path: path.replace(/[0-9a-f-]{36}/g, ':id'),
      status: null,
      elapsedMs: null,
    };
    if (/^\/api\/(chat|trips)/.test(path)) state.http.push(event);
    try {
      if (state.blockGet && method === 'GET' && /^\/api\/trips\//.test(path)) {
        event.status = 503;
        return send(res, 503, { error: { code: 'E2E_CANONICAL_UNAVAILABLE' } });
      }
      const raw = await body(req);
      const headers = { ...req.headers };
      delete headers.host;
      delete headers.connection;
      delete headers['content-length'];
      if (method === 'PUT' && state.fault === 'conflict') {
        state.fault = null;
        const before = await fetch(backend + path, { headers });
        const latest = await before.json();
        const changed = { ...JSON.parse(raw), title: '서울 3일 E2E-B' };
        const competing = await fetch(backend + path, {
          method: 'PUT',
          headers: {
            ...headers,
            'if-match': before.headers.get('etag'),
            'content-type': 'application/json',
          },
          body: JSON.stringify(changed),
        });
        state.competingWrite = {
          status: competing.status,
          previousTitle: latest.title,
        };
        await competing.arrayBuffer();
      }
      const response = await fetch(backend + path, {
        method,
        headers,
        ...(method !== 'GET' && method !== 'HEAD' ? { body: raw } : {}),
      });
      event.status = response.status;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (method === 'PUT' && state.fault === 'unknown' && response.ok) {
        state.fault = null;
        state.blockGet = true;
        event.delivery = 'RESPONSE_DROPPED';
        req.socket.destroy();
        return;
      }
      const out = {
        'content-type':
          response.headers.get('content-type') ?? 'application/json',
      };
      const cookies = response.headers.getSetCookie();
      if (cookies.length) out['set-cookie'] = cookies;
      const etag = response.headers.get('etag');
      if (etag) out.etag = etag.startsWith('W/') ? etag : `W/${etag}`;
      res.writeHead(response.status, out);
      res.end(bytes);
    } catch {
      event.status ??= 'NETWORK_ERROR';
      if (!res.destroyed)
        send(res, 502, { error: { code: 'E2E_PROXY_UNAVAILABLE' } });
    } finally {
      event.elapsedMs = performance.now() - started;
    }
  });
}
