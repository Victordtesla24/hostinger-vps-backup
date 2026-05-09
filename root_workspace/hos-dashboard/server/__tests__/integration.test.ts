/**
 * Sprint 7 — Extended Integration Tests
 * BRD Section 8 — Deep integration coverage beyond API contract tests
 *
 * Covers:
 * - Full WR lifecycle: DRAFT → FRONT_DOOR → ASSIGNED → IN_PROGRESS → PASSED (INT-01)
 * - WR archive endpoint (INT-02)
 * - Concurrent WR creation safety (INT-03)
 * - WebSocket real connection + CONNECTED event (INT-04)
 * - Telemetry snapshot consistency (INT-05)
 * - Gate iteration accumulation accuracy (INT-06)
 * - Security: no hardcoded API keys in source (INT-07)
 * - GET /api/v1/gates/:wrId individual gate (INT-08)
 * - GET /api/v1/gates/active (INT-09)
 * - Performance regression — extended endpoint coverage (INT-10)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import WebSocket from 'ws';

const BASE = process.env.TEST_SERVER_URL ?? 'http://localhost:8081';
const WS_URL = BASE.replace(/^http/, 'ws') + '/ws';

async function get(path: string) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function post(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function patch(path: string, body: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

async function del(path: string) {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  return { status: r.status, body: await r.json().catch(() => null) };
}

function freshWR(tag: string) {
  return {
    title: `INT ${tag} ${Date.now()}`,
    description: 'Extended integration test — BRD §8 coverage',
    type: 'feature' as const,
    priority: 2 as const,
  };
}

beforeAll(async () => {
  const r = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!r?.ok) throw new Error(`Server not reachable at ${BASE}. Run "npm run server" first.`);
});

// ── INT-01: Full WR lifecycle E2E ─────────────────────────────────────────────
describe('INT-01: Full WR lifecycle — DRAFT → FRONT_DOOR → ASSIGNED → PASSED', () => {
  let wrId: string;

  it('creates WR in DRAFT with gate DISARMED', async () => {
    const { status, body } = await post('/api/v1/wr', freshWR('lifecycle'));
    expect(status).toBe(201);
    expect(body.status).toBe('DRAFT');
    expect(body.gateState).toBe('DISARMED');
    expect(body.gateIterations).toBe(0);
    wrId = body.id;
  });

  it('transitions DRAFT → FRONT_DOOR', async () => {
    const { status, body } = await patch(`/api/v1/wr/${wrId}`, { status: 'FRONT_DOOR' });
    expect(status).toBe(200);
    expect(body.status).toBe('FRONT_DOOR');
  });

  it('adds decomposition → transitions to ASSIGNED', async () => {
    const { status, body } = await post(`/api/v1/wr/${wrId}/decomposition`, {
      summary: 'Automated integration lifecycle test',
      acceptanceCriteria: ['AC-1: creates correctly', 'AC-2: transitions correctly', 'AC-3: exports correctly'],
      qualityScore: 95,
      ambiguityFlags: [],
    });
    expect(status).toBe(201);
    expect(body.status).toBe('ASSIGNED');
    expect(body.decomposition).toBeTruthy();
  });

  it('assigns to orchestrator → WR has assignedAgent', async () => {
    const { status, body } = await post('/api/v1/agents/orc/assign', { wrId });
    expect(status).toBe(200);
    expect(body.assignedAgent).toBe('orc');
  });

  it('adds FAIL verdict → gate becomes ARMED, iterations = 1', async () => {
    const { status, body } = await post(`/api/v1/wr/${wrId}/verdict`, {
      verdict: 'FAIL',
      reason: 'First iteration — test coverage incomplete',
      hmacValid: true,
      hmacFingerprint: 'sha256-test-fp-1',
    });
    expect(status).toBe(201);
    expect(body.gateState).toBe('ARMED');
    expect(body.gateIterations).toBe(1);
  });

  it('adds second FAIL → iterations = 2', async () => {
    const { body } = await post(`/api/v1/wr/${wrId}/verdict`, {
      verdict: 'FAIL',
      reason: 'Second iteration — additional fixes required',
      hmacValid: true,
      hmacFingerprint: 'sha256-test-fp-2',
    });
    expect(body.gateIterations).toBe(2);
  });

  it('adds PASS verdict → gate becomes SOFT_RESOLVED', async () => {
    const { body } = await post(`/api/v1/wr/${wrId}/verdict`, {
      verdict: 'PASS',
      reason: 'All acceptance criteria verified — HMAC signed PASS',
      hmacValid: true,
      hmacFingerprint: 'sha256-test-fp-pass',
    });
    expect(body.gateState).toBe('SOFT_RESOLVED');
    expect(body.gateIterations).toBe(3);
  });

  it('transitions WR to PASSED and completedAt is set', async () => {
    const { status, body } = await patch(`/api/v1/wr/${wrId}`, { status: 'PASSED' });
    expect(status).toBe(200);
    expect(body.status).toBe('PASSED');
    expect(body.completedAt).toBeTruthy();
    expect(new Date(body.completedAt).getTime()).toBeGreaterThan(0);
  });

  it('export contains full lifecycle data — id, title, verdicts, trace', async () => {
    const { status, body } = await get(`/api/v1/wr/${wrId}/export?format=json`);
    expect(status).toBe(200);
    expect(body.id).toBe(wrId);
    expect(Array.isArray(body.verdicts)).toBe(true);
    expect(body.verdicts.length).toBeGreaterThanOrEqual(3);
    expect(body.gateState).toBe('SOFT_RESOLVED');
  });
});

// ── INT-02: WR archive endpoint ───────────────────────────────────────────────
describe('INT-02: WR archive — DELETE /api/v1/wr/:id/archive', () => {
  it('archives WR — returns { archived: true } and status becomes FAILED', async () => {
    const { body: created } = await post('/api/v1/wr', freshWR('archive'));
    const wrId = created.id;

    const { status, body } = await del(`/api/v1/wr/${wrId}/archive`);
    expect(status).toBe(200);
    expect(body.archived).toBe(true);

    const { body: fetched } = await get(`/api/v1/wr/${wrId}`);
    expect(fetched.status).toBe('FAILED');
  });
});

// ── INT-03: Concurrent WR creation ───────────────────────────────────────────
describe('INT-03: Concurrent WR creation — unique IDs under parallel load', () => {
  it('10 concurrent creates all succeed with unique IDs', async () => {
    const creates = Array.from({ length: 10 }, (_, i) =>
      post('/api/v1/wr', freshWR(`concurrent-${i}`))
    );
    const results = await Promise.all(creates);
    const ids = results.map(r => r.body?.id).filter(Boolean);
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
    for (const r of results) {
      expect(r.status).toBe(201);
    }
  });
});

// ── INT-04: WebSocket real connection + CONNECTED event ───────────────────────
describe('INT-04: WebSocket — real connection receives CONNECTED event', () => {
  it('WS connects to server and receives CONNECTED event within 3s', async () => {
    const received = await new Promise<{ event: string; data: unknown }>((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket CONNECTED event not received within 3s'));
      }, 3000);

      ws.on('message', (raw) => {
        clearTimeout(timer);
        ws.close();
        try {
          resolve(JSON.parse(raw.toString()));
        } catch {
          reject(new Error('WebSocket message was not valid JSON'));
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(received.event).toBe('CONNECTED');
    expect(received.data).toHaveProperty('ts');
  });
});

// ── INT-05: Telemetry snapshot consistency ────────────────────────────────────
describe('INT-05: Telemetry snapshot consistency — snapshot matches individual endpoints', () => {
  it('snapshot.vps has same top-level fields as /telemetry/vps', async () => {
    const [snapshotRes, vpsRes] = await Promise.all([
      get('/api/v1/telemetry/snapshot'),
      get('/api/v1/telemetry/vps'),
    ]);
    expect(snapshotRes.status).toBe(200);
    expect(vpsRes.status).toBe(200);
    const snapshotFields = Object.keys(snapshotRes.body.vps ?? {});
    const vpsFields = Object.keys(vpsRes.body ?? {});
    for (const field of ['cpuPercent', 'ramPercent', 'diskPercent']) {
      expect(snapshotFields, `snapshot.vps missing field: ${field}`).toContain(field);
      expect(vpsFields, `vps endpoint missing field: ${field}`).toContain(field);
    }
  });

  it('snapshot.pipeline has same fields as /telemetry/pipeline', async () => {
    const [snapshotRes, pipelineRes] = await Promise.all([
      get('/api/v1/telemetry/snapshot'),
      get('/api/v1/telemetry/pipeline'),
    ]);
    expect(snapshotRes.body.pipeline).toHaveProperty('stageBreakdown');
    expect(pipelineRes.body).toHaveProperty('stageBreakdown');
  });
});

// ── INT-06: Gate iteration accuracy ──────────────────────────────────────────
describe('INT-06: Gate iteration accumulation — 3 FAILs = 3 iterations exactly', () => {
  it('iterates correctly: 0 → 1 → 2 → 3 on successive FAIL verdicts', async () => {
    const { body: wr } = await post('/api/v1/wr', freshWR('gate-iter'));
    const id = wr.id;
    expect(wr.gateIterations).toBe(0);

    for (let i = 1; i <= 3; i++) {
      const { body } = await post(`/api/v1/wr/${id}/verdict`, {
        verdict: 'FAIL',
        reason: `Gate iteration test — cycle ${i}`,
        hmacValid: true,
        hmacFingerprint: `sha256-iter-${i}`,
      });
      expect(body.gateIterations).toBe(i);
      expect(body.gateState).toBe('ARMED');
    }

    const { body: verdicts } = await get(`/api/v1/wr/${id}/trace`);
    expect(Array.isArray(verdicts)).toBe(true);
  });
});

// ── INT-07: Security — no hardcoded API keys in source ───────────────────────
describe('INT-07: Security — no hardcoded API keys in source code (BRD §12.3)', () => {
  const srcRoot = resolve(process.cwd(), 'src');
  const serverRoot = resolve(process.cwd(), 'server');

  function scanDir(dir: string, extensions: string[] = ['.ts', '.tsx', '.js']): string[] {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      const files: string[] = [];
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) files.push(...scanDir(full, extensions));
        else if (extensions.some(ext => entry.name.endsWith(ext))) files.push(full);
      }
      return files;
    } catch { return []; }
  }

  const KEY_PATTERNS = [
    /sk-ant-[a-zA-Z0-9\-_]{20,}/,
    /sk-[a-zA-Z0-9]{40,}/,
    /AKIA[A-Z0-9]{16}/,
    /process\.env\.[A-Z_]+ (?:\|\|| \?\?) ['"`][a-zA-Z0-9\-_]{16,}['"`]/,
  ];

  it('no hardcoded Anthropic or AWS keys in src/ or server/ source files', () => {
    const files = [...scanDir(srcRoot), ...scanDir(serverRoot)];
    const violations: string[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8');
        for (const pattern of KEY_PATTERNS) {
          if (pattern.test(content)) {
            violations.push(`${file}: matched ${pattern.toString()}`);
          }
        }
      } catch { /* skip unreadable */ }
    }

    expect(violations, `Hardcoded API keys found:\n${violations.join('\n')}`).toHaveLength(0);
  });
});

// ── INT-08: Individual gate state — GET /api/v1/gates/:wrId ──────────────────
describe('INT-08: Individual WR gate state — GET /api/v1/gates/:wrId', () => {
  it('returns gate state object for a WR with a verdict', async () => {
    const { body: wr } = await post('/api/v1/wr', freshWR('gate-individual'));
    const { body } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL',
      reason: 'Gate individual state test',
      hmacValid: true,
      hmacFingerprint: 'sha256-ind-test',
    });
    expect(body.gateState).toBe('ARMED');

    const { status, body: gateBody } = await get(`/api/v1/gates/${wr.id}`);
    expect(status).toBe(200);
    expect(gateBody).toHaveProperty('state');
    expect(gateBody.state).toBe('ARMED');
  });
});

// ── INT-09: Active gates — GET /api/v1/gates/active ──────────────────────────
describe('INT-09: Active gates endpoint — GET /api/v1/gates/active', () => {
  it('returns an array of currently active (ARMED) gate WRs', async () => {
    const { status, body } = await get('/api/v1/gates/active');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('active gates endpoint includes ARMED WRs', async () => {
    const { body: wr } = await post('/api/v1/wr', freshWR('active-gate'));
    await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL',
      reason: 'Active gate membership test',
      hmacValid: true,
      hmacFingerprint: 'sha256-active-gate',
    });

    const { body: active } = await get('/api/v1/gates/active');
    const found = active.some((w: { wrId: string }) => w.wrId === wr.id);
    expect(found, `WR ${wr.id} not in active gates list`).toBe(true);
  });
});

// ── INT-10: Performance regression — extended endpoint coverage ───────────────
describe('INT-10: Performance regression — extended endpoint coverage (BRD §8.3)', () => {
  async function p95(path: string, n = 5): Promise<number> {
    const times: number[] = [];
    for (let i = 0; i < n; i++) {
      const start = Date.now();
      await fetch(`${BASE}${path}`);
      times.push(Date.now() - start);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];
  }

  it('GET /api/v1/agents — p95 < 50ms', async () => {
    const latency = await p95('/api/v1/agents');
    expect(latency).toBeLessThan(50);
  });

  it('GET /api/v1/gates/global — p95 < 50ms', async () => {
    const latency = await p95('/api/v1/gates/global');
    expect(latency).toBeLessThan(50);
  });

  it('GET /api/v1/gates/log — p95 < 50ms', async () => {
    const latency = await p95('/api/v1/gates/log?n=10');
    expect(latency).toBeLessThan(50);
  });

  it('POST /api/v1/wr — p95 < 200ms', async () => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await post('/api/v1/wr', freshWR(`perf-${i}`));
      times.push(Date.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95val = times[Math.floor(times.length * 0.95)] ?? times[times.length - 1];
    expect(p95val).toBeLessThan(200);
  });
});

// ── INT-11: Concurrent verdict stress test ────────────────────────────────────
describe('INT-11: Concurrent verdict stress — 10 FAILs on same WR', () => {
  it('10 concurrent FAIL verdicts all succeed, iterations = 10', async () => {
    const { body: wr } = await post('/api/v1/wr', freshWR('concurrent-verdict'));
    const verdict = {
      verdict: 'FAIL',
      reason: 'Concurrent stress test iteration',
      hmacValid: false,
      hmacFingerprint: '',
    };
    await Promise.all(Array.from({ length: 10 }, () =>
      post(`/api/v1/wr/${wr.id}/verdict`, verdict)
    ));
    const { body: final } = await get(`/api/v1/wr/${wr.id}`);
    expect(final.gateIterations).toBe(10);
    expect(final.verdicts).toHaveLength(10);
  });
});

// ── INT-12: Telemetry quality metrics structure ───────────────────────────────
describe('INT-12: Quality metrics — structure validation', () => {
  it('quality metrics has required numeric fields', async () => {
    const { status, body } = await get('/api/v1/telemetry/quality');
    expect(status).toBe(200);
    expect(typeof body.gatePassRatePercent).toBe('number');
    expect(typeof body.avgIterationsToPass).toBe('number');
    expect(typeof body.activeGates).toBe('number');
    expect(typeof body.totalVerifications).toBe('number');
    expect(body.gatePassRatePercent).toBeGreaterThanOrEqual(0);
    expect(body.gatePassRatePercent).toBeLessThanOrEqual(100);
  });

  it('quality metrics failReasonsHistogram is an object', async () => {
    const { body } = await get('/api/v1/telemetry/quality');
    expect(typeof body.failReasonsHistogram).toBe('object');
  });
});

// ── INT-13: WR ID format validation ──────────────────────────────────────────
describe('INT-13: WR ID format — R-YYYYMMDD-XXXXXXXX pattern', () => {
  it('all created WR IDs match expected format', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { body } = await post('/api/v1/wr', freshWR(`id-format-${i}`));
      ids.push(body.id);
    }
    const pattern = /^R-\d{8}-[A-Z0-9]{8}$/;
    ids.forEach(id => expect(id).toMatch(pattern));
  });
});

// ── INT-14: Gate state transitions via verdicts ───────────────────────────────
describe('INT-14: Gate state transitions via verdicts', () => {
  it('FAIL then PASS yields SOFT_RESOLVED gate, PASS verdict with hmacValid=true', async () => {
    const { body: wr } = await post('/api/v1/wr', freshWR('gate-transition'));
    const { body: failed } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL', reason: 'Initial fail', hmacValid: false, hmacFingerprint: '',
    });
    expect(failed.gateState).toBe('ARMED');

    const { body: passed } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'PASS', reason: 'All checks pass', hmacValid: true, hmacFingerprint: 'sha256:valid',
    });
    expect(passed.gateState).toBe('SOFT_RESOLVED');
    expect(passed.gateIterations).toBe(2);
    const verdicts = passed.verdicts as { verdict: string; hmacValid: boolean }[];
    const passVerdict = verdicts.find(v => v.verdict === 'PASS');
    expect(passVerdict?.hmacValid).toBe(true);
  });

  it('gate remains ARMED after multiple consecutive FAILs', async () => {
    const { body: wr } = await post('/api/v1/wr', freshWR('gate-armed-persist'));
    for (let i = 0; i < 5; i++) {
      await post(`/api/v1/wr/${wr.id}/verdict`, {
        verdict: 'FAIL', reason: `Fail iteration ${i}`, hmacValid: false, hmacFingerprint: '',
      });
    }
    const { body } = await get(`/api/v1/wr/${wr.id}`);
    expect(body.gateState).toBe('ARMED');
    expect(body.gateIterations).toBe(5);
  });
});

// ── INT-15: Annotations via human injection ──────────────────────────────────
describe('INT-15: Human annotations via agent inject', () => {
  it('injected annotation appears in WR annotations and trace', async () => {
    const { body: wr } = await post('/api/v1/wr', freshWR('annotation'));
    const annotation = 'PHD test annotation — human reviewer approved';
    const { status } = await post('/api/v1/agents/ver/inject', { wrId: wr.id, annotation });
    expect(status).toBe(201);

    const { body: updated } = await get(`/api/v1/wr/${wr.id}`);
    expect(updated.annotations).toContain(annotation);
    const traceStep = (updated.trace as { type: string }[]).find(s => s.type === 'human_annotation');
    expect(traceStep).toBeTruthy();
  });
});
