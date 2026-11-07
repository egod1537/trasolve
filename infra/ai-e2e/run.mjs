import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createServer as createViteServer } from 'vite';
import react from '@vitejs/plugin-react';
import { cases, project, expected } from './cases.mjs';
import { listen, stubServer, proxyServer } from './s3-transport.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const started = performance.now();
const session = `trasolve-e2e-${process.pid}-${Date.now()}`;
const browserBin = process.env.AGENT_BROWSER ?? 'agent-browser';
const exec = promisify(execFile);
const repeat = Number(
  process.argv.find((a) => a.startsWith('--repeat='))?.split('=')[1] ?? 1,
);
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 10)
  throw new Error('--repeat must be 1..10');
const state = {
  spec: null,
  http: [],
  provider: [],
  fault: null,
  blockGet: false,
};
const results = [];
const servers = [];
let vite,
  child,
  dataDir,
  browserOpened = false;
let phase = 'environment';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function browser(...args) {
  const { stdout } = await exec(
    browserBin,
    ['--session', session, '--json', ...args],
    { timeout: 150000, maxBuffer: 8 * 1024 * 1024 },
  ).catch((error) => {
    if (error.killed || error.code === 'ETIMEDOUT') {
      throw new Error('TIMEOUT: browser execution watchdog expired');
    }
    if (error.stdout?.trim().startsWith('{')) return { stdout: error.stdout };
    throw new Error(
      `ENVIRONMENT_BLOCKED: browser process ${error.code ?? 'failed'}`,
    );
  });
  const response = JSON.parse(stdout);
  if (!response.success)
    throw new Error(
      response.error ?? 'ENVIRONMENT_BLOCKED: browser command failed',
    );
  return 'result' in response.data ? response.data.result : response.data;
}
const evaluate = (js) => browser('eval', js);
async function reservePort() {
  const server = http.createServer();
  const url = await listen(server);
  await new Promise((r) => server.close(r));
  return Number(new URL(url).port);
}
async function ready(url) {
  for (let i = 0; i < 200; i++) {
    if (child?.exitCode !== null && child?.exitCode !== undefined)
      throw new Error('ENVIRONMENT_BLOCKED: backend exited');
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    await wait(100);
  }
  throw new Error('ENVIRONMENT_BLOCKED: backend startup deadline');
}
function classify(error) {
  const text = String(error);
  if (/TIMEOUT|timed out|timeout/i.test(text)) return 'TIMEOUT';
  if (/ENVIRONMENT_BLOCKED|ENOENT|EPERM|EACCES/.test(text))
    return 'ENVIRONMENT_BLOCKED';
  return 'ASSERTION_FAILURE';
}
function projected(trip, before) {
  const p = project(trip);
  const known = new Set(before.days.map((d) => d.id));
  for (const d of p.days) if (!known.has(d.id)) d.id = '<new-day>';
  return p;
}
function routeIntegrity(trip) {
  for (const d of trip.days) {
    assert.equal(
      new Set(d.places.map((p) => p.id)).size,
      d.places.length,
      'duplicate places',
    );
    const ids = new Set(d.places.map((p) => p.id));
    for (const p of d.polylines)
      assert.ok(
        ids.has(p.fromPlaceId) && ids.has(p.toPlaceId),
        'dangling route',
      );
    assert.deepEqual(
      d.places.map((p) => p.order),
      d.places.map((_, i) => i + 1),
      'place order',
    );
  }
}
function canonicalShape(trip, before) {
  trip = structuredClone(trip);
  for (const d of trip.days)
    if (!before.days.some((x) => x.id === d.id)) d.color = '<generated>';
  // New pending IDs may differ between Preview and server; compare by position.
  const ids = new Map();
  trip.days.forEach((d, i) => {
    ids.set(d.id, `day-${i}`);
    d.places.forEach((p, j) => ids.set(p.id, `place-${i}-${j}`));
    d.polylines.forEach((p, j) => ids.set(p.id, `line-${i}-${j}`));
  });
  const clean = (value) => {
    if (typeof value === 'string') return ids.get(value) ?? value;
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(
            ([k]) =>
              !['createdAt', 'updatedAt', 'userId', 'revision'].includes(k),
          )
          .map(([k, v]) => [k, clean(v)]),
      );
    return value;
  };
  return clean(trip);
}
function normalizedEvidence(value) {
  const ids = new Map();
  const clean = (v) => {
    if (typeof v === 'string')
      return v.replace(
        /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi,
        (id) => {
          if (!ids.has(id)) ids.set(id, `<id-${ids.size + 1}>`);
          return ids.get(id);
        },
      );
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v)
          .filter(
            ([k]) =>
              !['userId', 'createdAt', 'updatedAt', 'fingerprint'].includes(k),
          )
          .map(([k, x]) => [k, clean(x)]),
      );
    return v;
  };
  return clean(value);
}

try {
  // Do not load personal credentials or attach to an existing backend/database.
  if (existsSync(join(root, 'backend/.env.local')))
    throw new Error(
      'ENVIRONMENT_BLOCKED: use a clean worktree without backend/.env.local',
    );
  await exec(browserBin, ['--version']);
  await mkdir(join(root, '.local/ai-e2e'), { recursive: true });
  dataDir = await mkdtemp(join(root, '.local/ai-e2e/fixture-'));
  const stub = stubServer(state);
  servers.push(stub);
  const stubUrl = await listen(stub);
  const backendPort = await reservePort();
  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const proxy = proxyServer(backendUrl, state);
  servers.push(proxy);
  const proxyUrl = await listen(proxy);
  child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: join(root, 'backend'),
    stdio: ['ignore', 'ignore', 'ignore'],
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: String(backendPort),
      TRASOLVE_PERSISTENCE_MODE: 'local',
      TRASOLVE_DATA_DIR: dataDir,
      TRASOLVE_DEBUG_GUEST_AUTH: 'true',
      TRASOLVE_DEBUG_GUEST_SUBJECT: session,
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'fake-not-a-real-key',
      GEMINI_API_BASE_URL: `${stubUrl}/`,
      GEMINI_MODEL: 's3-mock',
      GEMINI_NATIVE_TOOLS: '1',
      TCACHE_BASE_URL: stubUrl,
      TROUTE_BASE_URL: stubUrl,
    },
  });
  await ready(`${backendUrl}/api/health`);
  // Vite also reads process.env: exclude inherited browser keys/DSNs, not just
  // .env files. This isolated run must never initialize paid/external clients.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('VITE_')) delete process.env[key];
  }
  vite = await createViteServer({
    configFile: false,
    root: join(root, 'frontend'),
    envDir: dataDir,
    logLevel: 'silent',
    plugins: [react()],
    resolve: { alias: { '@': join(root, 'frontend/src') } },
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: true,
      proxy: { '/api': proxyUrl },
    },
  });
  await vite.listen();
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const helper = await readFile(
    new URL('./browser.js', import.meta.url),
    'utf8',
  );
  browserOpened = true;
  await browser('open', `${base}/?debug=1`);
  await browser('wait', '--load', 'networkidle');
  await evaluate(helper);
  await evaluate(
    '(async()=>{await __s3.wait(()=>__s3.button("시작하기"));__s3.click("시작하기");return true})()',
  );
  await browser('wait', '--url', '**/map*');
  await browser('wait', '--load', 'networkidle');

  for (let round = 1; round <= repeat; round++)
    for (const scenario of cases) {
      const item = {
        id: scenario.id,
        round,
        provider: 'Mock (Gemini wire stub)',
        model: 's3-mock',
        result: scenario.disposition ?? 'FAIL',
        errorType: null,
        expectedError: scenario.error ?? null,
        input: scenario.prompt ?? null,
        reason: scenario.reason ?? null,
        timings: {},
        assertions: [],
        evidence: {},
      };
      results.push(item);
      if (scenario.disposition) {
        console.log(`${item.id} ${item.result}: ${item.reason}`);
        continue;
      }
      const caseStart = performance.now();
      state.spec = scenario;
      state.http = [];
      state.provider = [];
      state.fault = null;
      state.blockGet = false;
      state.competingWrite = null;
      try {
        phase = 'fixture';
        await browser('open', `${base}/map?debug=1`);
        await browser('wait', '--load', 'networkidle');
        await evaluate(helper);
        await evaluate(
          '(async()=>{await __s3.wait(()=>__s3.button("서울 예시 여행 만들기"));__s3.click("서울 예시 여행 만들기");await __s3.wait(()=>__s3.created && document.querySelector("h1"));return true})()',
        );
        const before = await evaluate('__s3.created');
        item.evidence.before = before;
        assert.deepEqual(
          before.days.map((d) => d.places.length),
          [3, 5, 7],
          'S0 fixture counts',
        );
        await evaluate(
          '(async()=>{await __s3.wait(()=>document.querySelector("textarea")||__s3.button("AI 패널 열기"));if(!document.querySelector("textarea"))__s3.click("AI 패널 열기");await __s3.wait(()=>document.querySelector("textarea"));return true})()',
        );
        phase = 'chat';
        await evaluate(
          `__s3.send(${JSON.stringify(scenario.prompt)}).then(()=>true)`,
        );
        const chat = await evaluate('__s3.chat');
        item.httpStatus = chat.status;
        item.timings.aiMs = chat.ms;
        item.evidence.response = chat.body;
        if (chat.status !== 200) {
          item.errorType = 'PROVIDER_ERROR';
          throw new Error('Chat API did not return 200');
        }
        const trace = state.provider.at(-1);
        assert.ok(trace, 'stub request observed');
        item.toolCall = chat.body.toolCall?.name ?? null;
        item.responseMode = trace.mode;
        assert.equal(
          item.toolCall,
          scenario.mode === 'native' ? 'propose_trip_command_plan' : null,
          'native vs JSON attribution',
        );
        phase = 'plan';
        const plan = await evaluate('__s3.prepare()');
        item.plan = plan.valid ? 'VALID' : 'INVALID';
        item.timings.planMs = plan.ms;
        item.evidence.plan = plan.plan;
        item.planError = plan.error;
        item.evidence.preview = plan.preview;
        await evaluate(
          '(async()=>{await __s3.wait(()=>__s3.card());return true})()',
        );
        item.evidence.previewUI = await evaluate('__s3.card().textContent');
        assert.equal(
          state.http.filter((e) => e.method === 'PUT').length,
          0,
          'Preview PUT 0',
        );
        if (scenario.error === 'TARGET_NOT_FOUND') {
          assert.equal(plan.error, 'unresolved_target');
          item.errorType = 'TARGET_NOT_FOUND';
          assert.equal(
            await evaluate('!!__s3.button("적용",__s3.card())'),
            false,
            'invalid Apply disabled',
          );
        } else {
          assert.ok(plan.valid && !plan.error, 'plan prepared');
          assert.deepEqual(
            projected(plan.preview.after, before),
            expected(before, scenario.id, 'preview'),
            'Preview expected changes only',
          );
          assert.equal(
            await evaluate('__s3.card().querySelectorAll("section").length'),
            2,
            'before/after Preview UI',
          );
          phase = scenario.cancel ? 'cancel' : 'apply';
          const saveStart = performance.now();
          state.fault = scenario.fault ?? null;
          if (scenario.cancel)
            await evaluate('__s3.button("취소",__s3.card()).click()');
          else
            await evaluate(
              `(()=>{const b=__s3.button("적용",__s3.card());if(!b)throw new Error("Apply missing");b.click();${scenario.doubleApply ? 'b.click();' : ''}return true})()`,
            );
          if (scenario.fault === 'unknown') {
            await evaluate(
              '(async()=>{await __s3.wait(()=>document.querySelector(".trip-ai-recovery"));return true})()',
            );
            assert.equal(
              await evaluate(
                '!!(__s3.card() && __s3.button("적용", __s3.card()))',
              ),
              false,
              'UNKNOWN blocks Apply',
            );
            item.evidence.recoveryUI = await evaluate(
              'document.querySelector(".trip-ai-recovery").textContent',
            );
            item.errorType = 'UNKNOWN_COMMIT';
            state.blockGet = false;
            await evaluate(
              '(async()=>{document.querySelector(".trip-ai-recovery button").click();await __s3.wait(()=>!document.querySelector(".trip-ai-recovery"));return true})()',
            );
          } else if (scenario.fault === 'conflict') {
            await evaluate(
              '(async()=>{await __s3.wait(()=>__s3.card()?.querySelector("[role=alert]"));return true})()',
            );
            assert.ok(
              state.http.some((e) => e.method === 'PUT' && e.status === 412),
              'real HTTP 412',
            );
            assert.equal(state.competingWrite?.status, 200, 'competing write');
            item.errorType = 'REVISION_CONFLICT';
          } else
            await evaluate(
              '(async()=>{await __s3.wait(()=>!__s3.card());return true})()',
            );
          item.timings.saveMs = scenario.cancel
            ? null
            : performance.now() - saveStart;
        }
        if (scenario.id === 'E2E-09') {
          item.variants = [];
          for (const variant of [
            {
              name: 'compound-invalid',
              error: 'TARGET_NOT_FOUND',
              ops: [
                { op: 'rename_trip', title: 'MUST_NOT_PERSIST' },
                ...scenario.ops,
              ],
            },
            {
              name: 'schema-invalid',
              error: 'INVALID_PLAN',
              ops: [{ op: 'unsupported_fixture_operation' }],
            },
            {
              name: 'provider-503',
              error: 'PROVIDER_ERROR',
              ops: [],
              status: 503,
            },
          ]) {
            state.spec = { ...scenario, ...variant };
            const vstart = performance.now();
            await evaluate(
              `__s3.send(${JSON.stringify(scenario.prompt)}).then(()=>true)`,
            );
            const response = await evaluate('__s3.chat');
            let validation = null;
            if (variant.status)
              assert.equal(
                response.status,
                502,
                'provider failure mapped by real backend',
              );
            else {
              assert.equal(response.status, 200);
              validation = await evaluate('__s3.prepare()');
              assert.equal(
                validation.error,
                variant.error === 'INVALID_PLAN'
                  ? 'INVALID_PLAN'
                  : 'unresolved_target',
              );
            }
            assert.deepEqual(
              projected(await evaluate('__s3.get()'), before),
              project(before),
              'failure must not partially apply',
            );
            assert.equal(
              state.http.filter((e) => e.method === 'PUT').length,
              0,
              'failure PUT 0',
            );
            item.variants.push({
              name: variant.name,
              result: 'PASS',
              errorType: variant.error,
              httpStatus: response.status,
              elapsedMs: performance.now() - vstart,
              response: response.body,
              validation,
            });
          }
        }
        item.evidence.afterUI = await evaluate(
          '({title:document.querySelector("h1")?.textContent,planAlerts:[...document.querySelectorAll(".trip-ai-plan [role=alert]")].map(x=>x.textContent),recovery:!!document.querySelector(".trip-ai-recovery")})',
        );
        phase = 'canonical';
        const canonical = await evaluate('__s3.get()');
        item.evidence.canonical = canonical;
        assert.deepEqual(
          projected(canonical, before),
          expected(before, scenario.id),
          'canonical expected changes only',
        );
        routeIntegrity(canonical);
        if (scenario.cancel || scenario.id === 'E2E-09') {
          assert.deepEqual(
            canonicalShape(canonical, before),
            canonicalShape(before, before),
            'Cancel/failure preserves full Trip',
          );
        }
        if (!scenario.cancel && !scenario.error)
          assert.deepEqual(
            canonicalShape(canonical, before),
            canonicalShape(plan.preview.after, before),
            'canonical equals Preview',
          );
        if (scenario.fault === 'unknown')
          assert.deepEqual(
            canonicalShape(canonical, before),
            canonicalShape(plan.preview.after, before),
            'recovered canonical equals Preview',
          );
        const puts = state.http.filter((e) => e.method === 'PUT');
        item.putCount = puts.length;
        assert.equal(
          puts.length,
          scenario.cancel || scenario.id === 'E2E-09' ? 0 : 1,
          'exact PUT count',
        );
        item.persistence = 'PASS';
        item.result = 'PASS';
        item.assertions = [
          'Preview PUT 0',
          'Expected changes only',
          'Canonical state',
          'Route references',
          'PUT count',
        ];
      } catch (error) {
        item.result =
          classify(error) === 'ENVIRONMENT_BLOCKED' ? 'BLOCKED' : 'FAIL';
        item.observedError = item.errorType;
        item.errorType =
          error.code === 'ERR_ASSERTION'
            ? 'ASSERTION_FAILURE'
            : (item.errorType ?? classify(error));
        item.failedStep = phase;
        // No raw browser/child stderr, credentials, cookies, or environment dumps.
        item.reason = String(error.message ?? error)
          .split('\n')[0]
          .slice(0, 200);
      } finally {
        state.blockGet = false;
        state.fault = null;
        try {
          item.cleanupStatus = await evaluate(
            'window.__s3?.created ? __s3.remove() : null',
          );
          if (item.evidence.before) assert.equal(item.cleanupStatus, 404);
        } catch {
          item.result = 'FAIL';
          item.errorType = 'ENVIRONMENT_BLOCKED';
          item.reason ??=
            'Fixture cleanup failed; isolated data directory will be removed';
        }
        item.evidence.http = [...state.http];
        item.evidence.provider = [...state.provider];
        item.timings.totalMs = performance.now() - caseStart;
        console.log(
          `${item.id} [${round}] ${item.result} | ${item.responseMode ?? 'NONE'} | AI=${item.timings.aiMs?.toFixed(0) ?? '-'}ms Plan=${item.timings.planMs?.toFixed(0) ?? '-'}ms Save=${item.timings.saveMs?.toFixed(0) ?? '-'}ms Total=${item.timings.totalMs.toFixed(0)}ms | Plan=${item.plan ?? 'NONE'} Tool=${item.toolCall ?? 'NONE'} PUT=${item.putCount ?? '-'} Persistence=${item.persistence ?? 'NOT_CONFIRMED'} | ${item.errorType ?? 'NONE'}${item.failedStep ? ` @${item.failedStep}: ${item.reason}` : ''}`,
        );
      }
    }
} catch (error) {
  console.error(
    `ENVIRONMENT_BLOCKED: ${String(error.message ?? error).split('\n')[0]}`,
  );
  for (const s of cases)
    if (!results.some((r) => r.id === s.id))
      results.push({
        id: s.id,
        result: s.disposition ?? 'BLOCKED',
        errorType: s.disposition ? null : 'ENVIRONMENT_BLOCKED',
      });
  process.exitCode = 1;
} finally {
  if (browserOpened) await browser('close').catch(() => {});
  if (vite) await vite.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), wait(5000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await once(child, 'exit');
    }
  }
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  const summary = {
    total: results.length,
    ...Object.fromEntries(
      ['PASS', 'FAIL', 'BLOCKED', 'LIVE_GATED', 'HUMAN_REVIEW'].map(
        (status) => [status, results.filter((r) => r.result === status).length],
      ),
    ),
    elapsedMs: performance.now() - started,
  };
  await mkdir(join(root, '.local/ai-e2e'), { recursive: true });
  const evidence = join(root, '.local/ai-e2e', `${session}.json`);
  await writeFile(
    evidence,
    JSON.stringify(
      {
        scope:
          'MOCK browser/API/Parser/Preview/Controller/persistence; not live language quality',
        summary,
        results: normalizedEvidence(results),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(summary));
  console.log(`Evidence: ${evidence}`);
  if (summary.FAIL || summary.BLOCKED) process.exitCode = 1;
}
