// S3 r18/harness.js browser helpers, scoped to one run and one Trip.
// Executed by agent-browser; no application routes or test branches are added.
(async () => {
  const H = (window.__s3 = { requests: [], created: null });
  const original = window.fetch.bind(window);
  window.fetch = async (input, options) => {
    const path = new URL(
      typeof input === 'string' ? input : input.url,
      location.href,
    ).pathname;
    const method = options?.method ?? 'GET';
    const entry = {
      path: path.replace(/[0-9a-f-]{36}/g, ':id'),
      method,
      start: performance.now(),
    };
    try {
      const r = await original(input, options);
      if (path === '/api/chat' || path.startsWith('/api/trips')) {
        entry.status = r.status;
        entry.ms = performance.now() - entry.start;
        const data = await r
          .clone()
          .json()
          .catch(() => null);
        if (path === '/api/chat') {
          entry.body = data;
          H.chat = entry;
        }
        if (path === '/api/trips' && method === 'POST' && r.ok)
          H.created = data;
        H.requests.push(entry);
      }
      return r;
    } catch (e) {
      entry.status = 'NETWORK_ERROR';
      entry.ms = performance.now() - entry.start;
      H.requests.push(entry);
      throw e;
    }
  };
  H.wait = async (fn, ms = 130000) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (fn()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('TIMEOUT: UI condition not reached');
  };
  H.button = (name, root = document) =>
    [...root.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === name && !b.disabled,
    );
  H.click = (name) => {
    const b = H.button(name);
    if (!b) throw new Error('ASSERTION_FAILURE: button missing');
    b.click();
  };
  H.card = () => document.querySelector('.trip-ai-plan');
  H.prepare = async () => {
    const { parseTripCommandPlanText } =
      await import('/src/features/map-workspace/ai-command/TripCommandPlanParser.ts');
    const { prepareTripCommandPlan } =
      await import('/src/features/map-workspace/ai-command/TripCommandPlanExecutor.ts');
    const start = performance.now();
    const parsed = parseTripCommandPlanText(H.chat.body.message.content);
    if (!parsed.success)
      return {
        valid: false,
        error: 'INVALID_PLAN',
        ms: performance.now() - start,
      };
    const prepared = await prepareTripCommandPlan(parsed.plan, H.created);
    return {
      valid: true,
      plan: parsed.plan,
      ms: performance.now() - start,
      error: prepared.success ? null : prepared.error.code,
      preview: prepared.success ? prepared.prepared.preview : null,
    };
  };
  H.send = async (prompt) => {
    H.chat = null;
    const input = document.querySelector('textarea');
    if (!input) throw new Error('ASSERTION_FAILURE: chat input missing');
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      'value',
    ).set.call(input, prompt);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    input.closest('form').requestSubmit();
    await H.wait(() => H.chat);
  };
  H.get = async () => {
    const r = await original(`/api/trips/${H.created.id}`);
    if (!r.ok)
      throw new Error(`ENVIRONMENT_BLOCKED: canonical GET ${r.status}`);
    return r.json();
  };
  H.remove = async () => {
    if (!H.created) return null;
    const path = `/api/trips/${H.created.id}`;
    const r = await original(path);
    if (!r.ok) return r.status;
    const deleted = await original(path, {
      method: 'DELETE',
      headers: { 'If-Match': r.headers.get('etag').replace(/^W\//, '') },
    });
    if (!deleted.ok)
      throw new Error(`ENVIRONMENT_BLOCKED: cleanup ${deleted.status}`);
    return (await original(path)).status;
  };
  return true;
})();
