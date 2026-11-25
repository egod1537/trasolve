import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import {
  API_ROUTES,
  CHAT_LIMITS,
  tripIdSchema,
  tripSchema,
} from '@trasolve/shared';
import { isLoopback, openBrowserTab, until } from './browser.mjs';
import { observeTraffic } from './trace.mjs';

const { values } = parseArgs({
  options: {
    manifest: { type: 'string' },
    origin: { type: 'string' },
    cdp: { type: 'string' },
    output: { type: 'string' },
  },
});
for (const [option, value] of Object.entries({
  manifest: values.manifest,
  origin: values.origin,
  cdp: values.cdp,
  output: values.output,
})) {
  if (!value) throw new Error(`Missing --${option}`);
}
const origin = loopbackOrigin(values.origin);
const debugOrigin = loopbackOrigin(values.cdp);
const manifestPath = resolve(values.manifest);
const rawManifest = await readFile(manifestPath);
const manifest = JSON.parse(rawManifest);
const source = manifest.sourceManifest
  ? await readFile(resolve(dirname(manifestPath), manifest.sourceManifest))
  : null;
const sourceCases = source ? JSON.parse(source).cases : [];
validateManifest(manifest, sourceCases);

const report = {
  version: 1,
  startedAt: new Date().toISOString(),
  origin: origin.origin,
  providerMode: manifest.providerMode,
  manifestSha256: digest(rawManifest),
  sourceManifestSha256: source ? digest(source) : null,
  results: [],
};
// Reserve a private local report before submitting anything.
await writeFile(values.output, JSON.stringify(report, null, 2) + '\n', {
  flag: 'wx',
  mode: 0o600,
});
for (const scenario of manifest.cases) {
  const prompt =
    scenario.prompt ??
    sourceCases.find(({ id }) => id === scenario.sourceCase).prompt;
  const result = await runCase(scenario, prompt);
  report.results.push(result);
  report.summary = {
    passed: report.results.filter(({ pass }) => pass).length,
    failed: report.results.filter(({ pass }) => !pass).length,
    total: manifest.cases.length,
  };
  await writeFile(values.output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    `${result.pass ? 'PASS' : 'FAIL'} ${result.id} ${result.outcome} ${result.elapsedMs}ms`,
  );
}
process.exitCode = report.summary.failed ? 1 : 0;

async function runCase(scenario, prompt) {
  const started = performance.now();
  const result = {
    id: scenario.id,
    sourceCase: scenario.sourceCase,
    tripId: scenario.tripId,
    prompt,
    expected: scenario.expect,
  };
  let tab;
  let trace;
  let stage = 'BROWSER_SETUP';
  try {
    tab = await openBrowserTab(debugOrigin);
    trace = await observeTraffic(tab, origin);
    const url = new URL('/map', origin);
    url.search = new URLSearchParams({ trip: scenario.tripId, debug: '1' });
    stage = 'APP_NOT_READY';
    const nav = await tab.send('Page.navigate', { url: url.href });
    if (nav.errorText) throw new Error(nav.errorText);
    await until(
      () => tab.evaluate(openComposer, origin.origin, scenario.tripId),
      20000,
      stage,
    );
    result.singleChat = await tab.evaluate(readSingleChat);
    if (!result.singleChat) throw new Error('Expected one fresh chat composer');
    stage = 'CANONICAL_BEFORE';
    result.before = await readCanonical(tab, scenario.tripId);
    const mismatches = valueMismatches(
      result.before.trip,
      scenario.expect.before,
    );
    if (mismatches.length) {
      stage = 'FIXTURE_MISMATCH';
      throw new Error(mismatches.join(', '));
    }
    stage = 'CHAT_SUBMIT';
    await tab.evaluate(fillComposer, prompt);
    await until(() => tab.evaluate(submitComposer, prompt), 5000, stage);
    const submittedAt = performance.now();

    stage = 'CHAT_TIMEOUT';
    await until(
      async () => {
        const ui = await tab.evaluate(readChat);
        return !ui.sending && (trace.finishedChatCount || ui.chatError) && ui;
      },
      150000,
      stage,
    );

    stage = 'CHAT_TRACE';
    result.traffic = await trace.collect();
    const chat = result.traffic.filter(({ kind }) => kind === 'chat');
    const response = chat[0]?.response;
    result.responseMs = chat[0]?.elapsedMs ?? null;
    if (chat.length > 1) {
      result.outcome = 'chat_error';
      result.code = 'MULTIPLE_CHAT_SUBMISSIONS';
    } else if (!response) {
      const ui = await tab.evaluate(readChat);
      result.outcome = 'chat_error';
      result.code =
        chat[0]?.code ??
        (chat[0]?.status
          ? `HTTP_${chat[0].status}`
          : chat[0]?.transportError
            ? 'CHAT_TRANSPORT'
            : 'CHAT_NOT_SENT');
      result.message = ui.chatError;
    } else {
      stage = 'PLAN_TIMEOUT';
      const ui = await until(
        async () => {
          const ui = await tab.evaluate(readChat);
          return ui.assistant && !ui.planPending && ui;
        },
        60000,
        stage,
      );
      result.uiMs = Math.round(performance.now() - submittedAt);
      result.preview = ui.preview;
      result.renderedPreview = ui.renderedPreview;
      result.outcome =
        ui.preview || ui.renderedPreview
          ? 'preview'
          : ui.planError
            ? 'plan_error'
            : 'response';
      result.code = ui.planError;
      result.message = ui.message;
    }
  } catch (error) {
    result.outcome = 'runner_error';
    result.code = error.code ?? stage;
    result.message = error.message;
  } finally {
    if (tab && trace) {
      try {
        if (result.before)
          result.after = await readCanonical(tab, scenario.tripId);
      } catch (error) {
        result.readbackError = error.message;
      }
      try {
        result.traffic = await trace.collect();
      } catch (error) {
        result.traceError = error.message;
      }
      result.tripWritesBlocked = trace.tripWrites;
      result.planDiagnostics = trace.diagnostics;
      result.observerError = trace.observerError;
    }
    if (tab)
      await tab.close().catch((error) => {
        result.cleanupError = error.message;
      });
  }
  result.persistedUnchanged = Boolean(
    result.before &&
    result.after &&
    isDeepStrictEqual(result.before, result.after),
  );
  result.failures = compare(result, scenario.expect);
  result.pass = result.failures.length === 0;
  result.elapsedMs = Math.round(performance.now() - started);
  return result;
}

function openComposer(origin, tripId) {
  if (
    location.origin !== origin ||
    location.pathname !== '/map' ||
    new URLSearchParams(location.search).get('trip') !== tripId
  )
    return false;
  const toggle = document.querySelector('.trip-map-ai-button');
  if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
  return Boolean(
    document
      .querySelector('#trip-map-ai-panel #trip-map-ai-input')
      ?.getClientRects().length,
  );
}

function readSingleChat() {
  return (
    Boolean(document.querySelector('.trip-ai-chat-layout.is-single-session')) &&
    !document.querySelector(
      '#trip-ai-chat-list, .trip-ai-chat-list-toggle, [role="log"] .is-user, .trip-map-ai-message.is-user',
    ) &&
    document.querySelectorAll('#trip-map-ai-input').length === 1
  );
}

function fillComposer(prompt) {
  const input = document.querySelector('#trip-map-ai-input');
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value',
  ).set;
  setValue.call(input, prompt);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitComposer(prompt) {
  const input = document.querySelector('#trip-map-ai-input');
  const button = input?.form?.querySelector(
    'button[type="submit"]:not(:disabled)',
  );
  if (!button || input.value !== prompt) return false;
  button.click();
  return true;
}

function readChat() {
  const panel = document.querySelector('#trip-map-ai-panel');
  const plan = panel?.querySelector('.trip-ai-plan');
  const preview = plan?.getAttribute('data-trip-plan-preview');
  const snapshots = plan?.querySelectorAll(':scope > div > section');
  const renderedPreview =
    snapshots?.length === 2
      ? { before: snapshots[0].innerText, after: snapshots[1].innerText }
      : undefined;
  return {
    sending:
      panel
        ?.querySelector('#trip-map-ai-input')
        ?.form?.getAttribute('aria-busy') === 'true',
    assistant: Boolean(
      panel?.querySelector(
        '.is-assistant:not(.is-pending):not([role="alert"])',
      ),
    ),
    chatError: panel?.querySelector(
      '.chat-v2-error, .trip-map-ai-message[role="alert"]',
    )?.textContent,
    planPending: plan?.getAttribute('aria-busy') === 'true',
    planError:
      plan?.getAttribute('data-trip-plan-error') ??
      (plan?.querySelector('[role="alert"]')
        ? 'PLAN_DIAGNOSTICS_UNAVAILABLE'
        : undefined),
    message: plan?.querySelector('[role="alert"]')?.textContent,
    preview: preview ? JSON.parse(preview) : undefined,
    renderedPreview,
  };
}

async function readCanonical(tab, tripId) {
  const path = `${API_ROUTES.trips}/${encodeURIComponent(tripId)}`;
  const { status, etag, body } = await tab.evaluate(
    async (origin, path) => {
      if (location.origin !== origin)
        throw new Error('Unexpected application origin');
      const response = await fetch(path, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      return {
        status: response.status,
        etag: response.headers.get('etag'),
        body: response.ok ? await response.json() : null,
      };
    },
    origin.origin,
    path,
  );
  if (status !== 200 || !/^(?:W\/)?"[1-9]\d*"$/.test(etag ?? '')) {
    throw new Error(
      `Canonical Trip GET HTTP ${status}, revision ${etag ? 'invalid' : 'missing'}`,
    );
  }
  const trip = tripSchema.parse(body);
  if (trip.id !== tripId) throw new Error('Canonical Trip ID mismatch');
  return { etag, trip };
}

function compare(result, expected) {
  const failures = [];
  if (!result.singleChat) failures.push('SINGLE_CHAT_UNVERIFIED');
  if (result.outcome !== expected.outcome) failures.push('OUTCOME_MISMATCH');
  if (expected.code && result.code !== expected.code)
    failures.push('ERROR_CODE_MISMATCH');
  if (
    expected.errorIncludes &&
    !result.message?.includes(expected.errorIncludes)
  )
    failures.push('ERROR_TEXT_MISMATCH');
  if (result.readbackError || !result.persistedUnchanged)
    failures.push('CANONICAL_STATE_UNVERIFIED_OR_CHANGED');
  if (result.tripWritesBlocked?.length) failures.push('TRIP_WRITE_ATTEMPTED');
  if (result.observerError || result.traceError || result.cleanupError)
    failures.push('BROWSER_OBSERVATION_INCOMPLETE');
  if (result.responseMs == null) failures.push('RESPONSE_TIME_UNVERIFIED');
  const response = result.traffic?.find(
    ({ kind }) => kind === 'chat',
  )?.response;
  if (
    expected.responseIncludes &&
    !response?.message.content.includes(expected.responseIncludes)
  ) {
    failures.push('RESPONSE_MISMATCH');
  }
  if (expected.tool && response?.toolCall?.name !== expected.tool)
    failures.push('TOOL_MISMATCH');
  if (
    expected.placesCalls !== undefined &&
    expected.placesCalls !==
      result.traffic?.filter(({ kind }) => kind === 'places').length
  ) {
    failures.push('PLACES_CALL_COUNT_MISMATCH');
  }
  if (
    expected.beforeText &&
    !result.renderedPreview?.before.includes(expected.beforeText)
  )
    failures.push('PREVIEW_BEFORE_TEXT_MISMATCH');
  if (
    expected.afterText &&
    !result.renderedPreview?.after.includes(expected.afterText)
  )
    failures.push('PREVIEW_AFTER_TEXT_MISMATCH');
  if (expected.diffOps && !result.preview)
    failures.push('STRUCTURED_PREVIEW_UNAVAILABLE');
  if (expected.diffOps && result.preview) {
    if (!isDeepStrictEqual(result.before?.trip, result.preview.before))
      failures.push('PREVIEW_BASE_MISMATCH');
    const ops = result.preview.diff.map(({ op }) => op).sort();
    if (!isDeepStrictEqual(ops, [...expected.diffOps].sort()))
      failures.push('DIFF_OPERATIONS_MISMATCH');
    for (const pointer of valueMismatches(
      result.preview.after,
      expected.after,
    )) {
      failures.push(`PREVIEW_VALUE_MISMATCH:${pointer}`);
    }
  }
  return failures;
}

function valueMismatches(trip, expectations) {
  return Object.entries(expectations ?? {})
    .filter(
      ([pointer, value]) =>
        !isDeepStrictEqual(readPointer(trip, pointer), value),
    )
    .map(([pointer]) => pointer);
}

function readPointer(value, pointer) {
  for (const token of pointer.slice(1).split('/')) {
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
    value = value && Object.hasOwn(value, key) ? value[key] : undefined;
  }
  return value;
}

function validateManifest(input, sources) {
  if (
    !['synthetic', 'real'].includes(input.providerMode) ||
    !Array.isArray(input.cases) ||
    !input.cases.length
  ) {
    throw new Error('Expected providerMode and a non-empty cases array');
  }
  const ids = new Set();
  for (const { id, tripId, prompt, sourceCase, expect } of input.cases) {
    const sourceRow = sources.find((row) => row.id === sourceCase);
    const message = prompt ?? sourceRow?.prompt;
    if (
      typeof id !== 'string' ||
      !/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(id) ||
      ids.has(id) ||
      !tripIdSchema.safeParse(tripId).success ||
      (sourceCase && (!sourceRow || prompt !== undefined)) ||
      typeof message !== 'string' ||
      !message.trim() ||
      message.length > CHAT_LIMITS.messageLength ||
      !['preview', 'plan_error', 'chat_error', 'response'].includes(
        expect?.outcome,
      ) ||
      (expect.outcome === 'chat_error' && !nonempty(expect.code)) ||
      (expect.outcome === 'plan_error' &&
        !nonempty(expect.code) &&
        !nonempty(expect.errorIncludes)) ||
      (expect.outcome === 'response' &&
        (typeof expect.responseIncludes !== 'string' ||
          !expect.responseIncludes)) ||
      (expect.outcome === 'preview' &&
        !expect.diffOps &&
        !nonempty(expect.afterText)) ||
      (expect.diffOps !== undefined &&
        (!Array.isArray(expect.diffOps) ||
          !expect.diffOps.every((op) => typeof op === 'string'))) ||
      (expect.after !== undefined && !expect.diffOps) ||
      [expect.beforeText, expect.afterText, expect.errorIncludes].some(
        (text) => text !== undefined && !nonempty(text),
      ) ||
      (expect.placesCalls !== undefined &&
        (!Number.isSafeInteger(expect.placesCalls) ||
          expect.placesCalls < 0)) ||
      [expect.before, expect.after].some(
        (checks) =>
          checks !== undefined &&
          (!checks ||
            typeof checks !== 'object' ||
            Array.isArray(checks) ||
            Object.keys(checks).some((pointer) => !pointer.startsWith('/'))),
      )
    ) {
      throw new Error(`Invalid batch scenario: ${id ?? '(missing id)'}`);
    }
    ids.add(id);
  }
}

function nonempty(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function loopbackOrigin(value) {
  const url = new URL(value);
  if (!isLoopback(url) || url.href !== `${url.origin}/`)
    throw new Error('Expected loopback HTTP origin');
  return url;
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
