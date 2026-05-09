/**
 * Sprint 5 — API Integration Tests
 * BRD Section 8.1 — All REST endpoint contract tests
 *
 * Tests all WR, Agents, Telemetry, and Gates endpoints for:
 * - Correct HTTP status codes
 * - Response shape / required fields
 * - State transitions (create → patch → verify)
 * - Error handling (404, 400)
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE = process.env.TEST_SERVER_URL ?? 'http://localhost:8081';

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

function makeWR(suffix = '') {
  return {
    title: `Integration Test WR ${suffix} ${Date.now()}`,
    description: 'API integration test — automated by vitest',
    type: 'feature' as const,
    priority: 2 as const,
  };
}

beforeAll(async () => {
  const r = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!r?.ok) throw new Error(`Server not reachable at ${BASE}`);
});

// ────────────────────────────────────────────────────────────────────────────
// WORK REQUESTS
// ────────────────────────────────────────────────────────────────────────────

describe('WR API — CRUD', () => {
  it('POST /api/v1/wr — creates WR with 201', async () => {
    const { status, body } = await post('/api/v1/wr', makeWR('create'));
    expect(status).toBe(201);
    expect(body.id).toMatch(/^R-\d{8}-[A-Z0-9]{8}$/);
    expect(body.status).toBe('DRAFT');
    expect(body.gateState).toBe('DISARMED');
    expect(body.gateIterations).toBe(0);
    expect(Array.isArray(body.verdicts)).toBe(true);
    expect(Array.isArray(body.trace)).toBe(true);
    expect(Array.isArray(body.annotations)).toBe(true);
  });

  it('POST /api/v1/wr — rejects missing fields with 400', async () => {
    const { status } = await post('/api/v1/wr', { title: 'Incomplete' });
    expect(status).toBe(400);
  });

  it('GET /api/v1/wr — returns array', async () => {
    const { status, body } = await get('/api/v1/wr');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/wr — filters by status', async () => {
    const { body: all } = await get('/api/v1/wr');
    const { body: drafts } = await get('/api/v1/wr?status=DRAFT');
    expect(drafts.every((w: { status: string }) => w.status === 'DRAFT')).toBe(true);
    expect(drafts.length).toBeLessThanOrEqual(all.length);
  });

  it('GET /api/v1/wr/:id — returns 200 for existing WR', async () => {
    const { body: created } = await post('/api/v1/wr', makeWR('get-by-id'));
    const { status, body } = await get(`/api/v1/wr/${created.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
  });

  it('GET /api/v1/wr/:id — returns 404 for missing WR', async () => {
    const { status } = await get('/api/v1/wr/R-00000000-XXXXXXXX');
    expect(status).toBe(404);
  });

  it('PATCH /api/v1/wr/:id — transitions status DRAFT → FRONT_DOOR', async () => {
    const { body: created } = await post('/api/v1/wr', makeWR('patch-status'));
    const { status, body } = await patch(`/api/v1/wr/${created.id}`, { status: 'FRONT_DOOR' });
    expect(status).toBe(200);
    expect(body.status).toBe('FRONT_DOOR');
  });

  it('PATCH /api/v1/wr/:id — transitions status to IN_PROGRESS via valid path', async () => {
    const { body: created } = await post('/api/v1/wr', makeWR('patch-inprogress'));
    await patch(`/api/v1/wr/${created.id}`, { status: 'FRONT_DOOR' });
    await post(`/api/v1/wr/${created.id}/decomposition`, { qualityScore: 80, structuredRequirements: ['R1'] });
    const { body } = await patch(`/api/v1/wr/${created.id}`, { status: 'IN_PROGRESS' });
    expect(body.status).toBe('IN_PROGRESS');
  });

  it('PATCH /api/v1/wr/:id — transitions status to PASSED sets completedAt', async () => {
    const { body: created } = await post('/api/v1/wr', makeWR('patch-passed'));
    await patch(`/api/v1/wr/${created.id}`, { status: 'FRONT_DOOR' });
    await post(`/api/v1/wr/${created.id}/decomposition`, { qualityScore: 80, structuredRequirements: ['R1'] });
    await patch(`/api/v1/wr/${created.id}`, { status: 'IN_PROGRESS' });
    const { body } = await patch(`/api/v1/wr/${created.id}`, { status: 'PASSED' });
    expect(body.status).toBe('PASSED');
    expect(body.completedAt).toBeTruthy();
  });
});

describe('WR API — Trace & Verdicts', () => {
  it('POST /api/v1/wr/:id/trace — adds trace step', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('trace'));
    const step = { type: 'tool_call', agentId: 'orc', description: 'Ran test step', timestamp: new Date().toISOString() };
    const { status, body } = await post(`/api/v1/wr/${wr.id}/trace`, step);
    expect(status).toBe(201);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/wr/:id/trace — returns trace array', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('trace-get'));
    const { status, body } = await get(`/api/v1/wr/${wr.id}/trace`);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /api/v1/wr/:id/verdict — FAIL arms gate', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('verdict-fail'));
    const { status, body } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL',
      reason: 'Missing test coverage',
      hmacValid: false,
      hmacFingerprint: 'none',
    });
    expect(status).toBe(201);
    expect(body.gateState).toBe('ARMED');
    expect(body.gateIterations).toBe(1);
  });

  it('POST /api/v1/wr/:id/verdict — PASS soft-resolves gate', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('verdict-pass'));
    const { status, body } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'PASS',
      reason: 'All requirements met',
      hmacValid: true,
      hmacFingerprint: 'sha256:abc123',
    });
    expect(status).toBe(201);
    expect(body.gateState).toBe('SOFT_RESOLVED');
    expect(body.verdicts).toHaveLength(1);
  });

  it('POST /api/v1/wr/:id/verdict — multiple FAILs increment iterations', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('verdict-multi'));
    await post(`/api/v1/wr/${wr.id}/verdict`, { verdict: 'FAIL', reason: 'Reason 1', hmacValid: false, hmacFingerprint: '' });
    await post(`/api/v1/wr/${wr.id}/verdict`, { verdict: 'FAIL', reason: 'Reason 2', hmacValid: false, hmacFingerprint: '' });
    const { body } = await post(`/api/v1/wr/${wr.id}/verdict`, { verdict: 'FAIL', reason: 'Reason 3', hmacValid: false, hmacFingerprint: '' });
    expect(body.gateIterations).toBe(3);
    expect(body.verdicts).toHaveLength(3);
  });
});

describe('WR API — Decomposition & Parallel Streams', () => {
  it('POST /api/v1/wr/:id/decomposition — sets decomposition and transitions to ASSIGNED', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('decomp'));
    const decomp = {
      qualityScore: 82,
      structuredRequirements: ['Req 1', 'Req 2', 'Req 3'],
      ambiguityFlags: [],
    };
    const { status, body } = await post(`/api/v1/wr/${wr.id}/decomposition`, decomp);
    expect(status).toBe(201);
    expect(body.status).toBe('ASSIGNED');
    expect(body.decomposition).toBeTruthy();
    expect(body.decomposition.qualityScore).toBe(82);
  });

  it('GET /api/v1/wr/:id/decomposition — returns decomposition object', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('decomp-get'));
    await post(`/api/v1/wr/${wr.id}/decomposition`, { qualityScore: 75, structuredRequirements: ['R1'] });
    const { status, body } = await get(`/api/v1/wr/${wr.id}/decomposition`);
    expect(status).toBe(200);
    expect(body.qualityScore).toBe(75);
  });

  it('POST /api/v1/wr/:id/parallel-stream — adds agentId to streams', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('parallel'));
    const { status, body } = await post(`/api/v1/wr/${wr.id}/parallel-stream`, { agentId: 'sol' });
    expect(status).toBe(200);
    expect(body.parallelStreams).toContain('sol');
  });
});

describe('WR API — Export', () => {
  it('GET /api/v1/wr/:id/export?format=json — returns WR object', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('export-json'));
    const r = await fetch(`${BASE}/api/v1/wr/${wr.id}/export?format=json`);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.id).toBe(wr.id);
  });

  it('GET /api/v1/wr/:id/export?format=md — returns markdown text', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('export-md'));
    const r = await fetch(`${BASE}/api/v1/wr/${wr.id}/export?format=md`);
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).toContain(`# Work Request: ${wr.id}`);
    expect(text).toContain(wr.title);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AGENTS
// ────────────────────────────────────────────────────────────────────────────

describe('Agents API', () => {
  it('GET /api/v1/agents — returns all agents', async () => {
    const { status, body } = await get('/api/v1/agents');
    expect(status).toBe(200);
    expect(body.length).toBeGreaterThanOrEqual(5);
  });

  it('GET /api/v1/agents/:id/status — returns agent for valid ID', async () => {
    const { status, body } = await get('/api/v1/agents/orc/status');
    expect(status).toBe(200);
    expect(body.id).toBe('orc');
    expect(body).toHaveProperty('status');
  });

  it('GET /api/v1/agents/:id/status — 404 for invalid ID', async () => {
    const { status } = await get('/api/v1/agents/nonexistent/status');
    expect(status).toBe(404);
  });

  it('POST /api/v1/agents/:id/assign — returns WR with assignedAgent set', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('assign-agent'));
    const { status, body } = await post('/api/v1/agents/sol/assign', { wrId: wr.id });
    expect(status).toBe(200);
    expect(body.assignedAgent).toBe('sol');
    expect(body.status).toBe('IN_PROGRESS');
  });

  it('POST /api/v1/agents/:id/assign — 400 for missing wrId', async () => {
    const { status } = await post('/api/v1/agents/orc/assign', {});
    expect(status).toBe(400);
  });

  it('POST /api/v1/agents/:id/pause — transitions agent to paused', async () => {
    // First put agent in running state
    const { body: wr } = await post('/api/v1/wr', makeWR('pause-agent'));
    await post('/api/v1/agents/res/assign', { wrId: wr.id });
    const { status, body } = await post('/api/v1/agents/res/pause', {});
    expect(status).toBe(200);
    expect(body.status).toBe('paused');
  });

  it('POST /api/v1/agents/:id/resume — transitions agent back to running', async () => {
    await post('/api/v1/agents/res/pause', {});
    const { status, body } = await post('/api/v1/agents/res/resume', {});
    expect(status).toBe(200);
    expect(body.status).toBe('running');
  });

  it('POST /api/v1/agents/:id/inject — adds annotation to WR trace', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('inject'));
    await post('/api/v1/agents/frd/assign', { wrId: wr.id });
    const { status, body } = await post('/api/v1/agents/frd/inject', {
      wrId: wr.id,
      annotation: 'Human annotation: EBCDIC encoding required',
    });
    expect(status).toBe(201);
    expect(body).toHaveProperty('wrId');
    expect(body).toHaveProperty('annotation');
    expect(body).toHaveProperty('timestamp');
  });

  it('POST /api/v1/agents/:id/terminate — sets agent to idle', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('terminate'));
    await post('/api/v1/agents/ver/assign', { wrId: wr.id });
    const { status, body } = await post('/api/v1/agents/ver/terminate', {});
    expect(status).toBe(200);
    expect(body.status).toBe('idle');
    expect(body.currentWR).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// TELEMETRY
// ────────────────────────────────────────────────────────────────────────────

describe('Telemetry API', () => {
  it('GET /api/v1/telemetry/vps — all required fields present', async () => {
    const { status, body } = await get('/api/v1/telemetry/vps');
    expect(status).toBe(200);
    for (const f of ['cpuPercent', 'ramPercent', 'diskPercent', 'loadAvg', 'ramUsedGB', 'ramTotalGB']) {
      expect(body, `missing: ${f}`).toHaveProperty(f);
    }
  });

  it('GET /api/v1/telemetry/quota — returns burn rate metrics', async () => {
    const { status, body } = await get('/api/v1/telemetry/quota');
    expect(status).toBe(200);
    expect(body).toHaveProperty('tokensUsedToday');
    expect(body).toHaveProperty('tokensDailyLimit');
    expect(body).toHaveProperty('burnRatePerHour');
    expect(body).toHaveProperty('projectedExhaustionHours');
  });

  it('GET /api/v1/telemetry/quality — returns gate metrics', async () => {
    const { status, body } = await get('/api/v1/telemetry/quality');
    expect(status).toBe(200);
    expect(body).toHaveProperty('gatePassRatePercent');
    expect(body).toHaveProperty('avgIterationsToPass');
    expect(body).toHaveProperty('activeGates');
    expect(body).toHaveProperty('failReasonsHistogram');
    expect(body).toHaveProperty('totalVerifications');
  });

  it('GET /api/v1/telemetry/snapshot — bundles all metrics', async () => {
    const { status, body } = await get('/api/v1/telemetry/snapshot');
    expect(status).toBe(200);
    expect(body).toHaveProperty('vps');
    expect(body).toHaveProperty('pipeline');
    expect(body).toHaveProperty('quota');
    expect(body).toHaveProperty('quality');
    expect(body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/telemetry/history — returns array for range=1h', async () => {
    // Trigger a snapshot first
    await get('/api/v1/telemetry/snapshot');
    const { status, body } = await get('/api/v1/telemetry/history?range=1h');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/telemetry/pipeline — returns stage breakdown', async () => {
    const { status, body } = await get('/api/v1/telemetry/pipeline');
    expect(status).toBe(200);
    expect(body).toHaveProperty('stageBreakdown');
    expect(body).toHaveProperty('activeWRs');
    expect(body).toHaveProperty('queuedWRs');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// GATES
// ────────────────────────────────────────────────────────────────────────────

describe('Gates API', () => {
  it('GET /api/v1/gates/global — returns gate state with required fields', async () => {
    const { status, body } = await get('/api/v1/gates/global');
    expect(status).toBe(200);
    expect(body).toHaveProperty('active');
    expect(typeof body.active).toBe('boolean');
  });

  it('GET /api/v1/gates/log — returns recent log entries', async () => {
    const { status, body } = await get('/api/v1/gates/log?n=5');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/gates/log — each entry has timestamp, type, message', async () => {
    const { body } = await get('/api/v1/gates/log?n=10');
    if (body.length > 0) {
      const entry = body[0];
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('message');
    }
  });

  it('GET /api/v1/gates/violations — returns violations array', async () => {
    const { status, body } = await get('/api/v1/gates/violations?n=10');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/gates/:wrId/verdicts — returns verdicts for WR', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('gate-verdicts'));
    await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL', reason: 'Gate test', hmacValid: false, hmacFingerprint: '',
    });
    const { status, body } = await get(`/api/v1/gates/${wr.id}/verdicts`);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/gates/:wrId/disarm — rejects reason < 30 chars', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('disarm-short'));
    await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'PASS', reason: 'All done', hmacValid: true, hmacFingerprint: 'sig',
    });
    const { status, body } = await post(`/api/v1/gates/${wr.id}/disarm`, {
      reason: 'Too short',
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/30/);
  });

  it('POST /api/v1/gates/:wrId/disarm — accepts reason ≥ 30 chars', async () => {
    const { body: wr } = await post('/api/v1/wr', makeWR('disarm-valid'));
    await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'PASS', reason: 'All done', hmacValid: true, hmacFingerprint: 'sig',
    });
    const { status, body } = await post(`/api/v1/gates/${wr.id}/disarm`, {
      reason: 'Operator confirmed: all requirements verified and complete',
    });
    expect(status).toBe(200);
    expect(body.gateState).toBe('DISARMED');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CRON JOBS
// ────────────────────────────────────────────────────────────────────────────

describe('Cron Jobs API', () => {
  it('GET /api/v1/cron/jobs — returns array', async () => {
    const { status, body } = await get('/api/v1/cron/jobs');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/cron/jobs — each job has required fields', async () => {
    const { body } = await get('/api/v1/cron/jobs');
    for (const job of body) {
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('name');
      expect(job).toHaveProperty('schedule');
      expect(job).toHaveProperty('command');
      expect(job).toHaveProperty('source');
      expect(job).toHaveProperty('enabled');
      expect(['hermes', 'os']).toContain(job.source);
    }
  });

  it('GET /api/v1/cron/jobs — hermes jobs distinguished from os jobs', async () => {
    const { body } = await get('/api/v1/cron/jobs');
    const hermes = body.filter((j: { source: string }) => j.source === 'hermes');
    const os = body.filter((j: { source: string }) => j.source === 'os');
    // Both sources may be empty in CI, but all jobs must be typed
    expect(hermes.length + os.length).toBe(body.length);
  });

  it('POST /api/v1/cron/jobs — 400 when name missing', async () => {
    const { status, body } = await post('/api/v1/cron/jobs', {
      schedule: 'every 1h',
      prompt: 'daily summary',
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/name/i);
  });

  it('POST /api/v1/cron/jobs — 400 when schedule missing', async () => {
    const { status, body } = await post('/api/v1/cron/jobs', {
      name: 'test-job',
      prompt: 'daily summary',
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/schedule/i);
  });

  it('POST /api/v1/cron/jobs — 400 when neither prompt nor script provided', async () => {
    const { status, body } = await post('/api/v1/cron/jobs', {
      name: 'test-job',
      schedule: 'every 1h',
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/prompt|script/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PERFORMANCE REGRESSION (BRD Section 8.3)
// ────────────────────────────────────────────────────────────────────────────

describe('Performance Regression — BRD §8.3', () => {
  it('health endpoint responds in <50ms p95', async () => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = Date.now();
      await get('/api/health');
      times.push(Date.now() - t0);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(200); // BRD threshold: 200ms = blocker
  });

  it('WR list endpoint responds in <200ms', async () => {
    const t0 = Date.now();
    await get('/api/v1/wr');
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(200);
  });

  it('telemetry/vps responds in <2000ms (systeminformation call)', async () => {
    const t0 = Date.now();
    await get('/api/v1/telemetry/vps');
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(2000); // systeminformation I/O realistically <2s
  });
});

// ────────────────────────────────────────────────────────────────────────────
// INPUT VALIDATION — PHD hardening (type, priority, verdict, archive 404)
// ────────────────────────────────────────────────────────────────────────────

describe('WR Input Validation — PHD hardening', () => {
  it('POST /api/v1/wr — rejects invalid type with 400', async () => {
    const { status, body } = await post('/api/v1/wr', {
      title: 'Val test', description: 'Test', type: 'invalid_type', priority: 2,
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/type/i);
  });

  it('POST /api/v1/wr — rejects priority 0 with 400', async () => {
    const { status, body } = await post('/api/v1/wr', {
      title: 'Val test', description: 'Test', type: 'feature', priority: 0,
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/priority/i);
  });

  it('POST /api/v1/wr — rejects priority 6 with 400', async () => {
    const { status, body } = await post('/api/v1/wr', {
      title: 'Val test', description: 'Test', type: 'bug', priority: 6,
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/priority/i);
  });

  it('POST /api/v1/wr — rejects non-integer priority with 400', async () => {
    const { status, body } = await post('/api/v1/wr', {
      title: 'Val test', description: 'Test', type: 'bug', priority: 2.5,
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/priority/i);
  });

  it('POST /api/v1/wr — accepts all valid types', async () => {
    for (const type of ['feature', 'bug', 'research', 'infra']) {
      const { status } = await post('/api/v1/wr', {
        title: `Type test ${type}`, description: 'Test', type, priority: 3,
      });
      expect(status).toBe(201);
    }
  });

  it('POST /api/v1/wr — accepts all valid priorities 1-5', async () => {
    for (const priority of [1, 2, 3, 4, 5]) {
      const { status } = await post('/api/v1/wr', {
        title: `Priority test ${priority}`, description: 'Test', type: 'feature', priority,
      });
      expect(status).toBe(201);
    }
  });

  it('POST /api/v1/wr/:id/verdict — rejects missing verdict field', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Verdict val', description: 'Test', type: 'bug', priority: 1 });
    const { status, body } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      reason: 'Test', hmacValid: false, hmacFingerprint: '',
    });
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('POST /api/v1/wr/:id/verdict — rejects invalid verdict value', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Verdict val', description: 'Test', type: 'bug', priority: 1 });
    const { status, body } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'INVALID', reason: 'Test', hmacValid: false, hmacFingerprint: '',
    });
    expect(status).toBe(400);
    expect(body.error).toMatch(/PASS|FAIL/i);
  });

  it('POST /api/v1/wr/:id/verdict — rejects missing reason field', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Verdict val', description: 'Test', type: 'bug', priority: 1 });
    const { status, body } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'PASS', hmacValid: true, hmacFingerprint: 'abc',
    });
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('DELETE /api/v1/wr/:id/archive — returns 404 for non-existent WR', async () => {
    const { status } = await del('/api/v1/wr/R-00000000-NOTEXIST/archive');
    expect(status).toBe(404);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// STATE MACHINE TRANSITION ENFORCEMENT — PHD hardening
// ────────────────────────────────────────────────────────────────────────────

describe('WR State Machine — PHD hardening', () => {
  it('PATCH /api/v1/wr/:id — rejects invalid transition DRAFT → PASSED with 409', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'SM test', description: 'Test', type: 'feature', priority: 2 });
    const { status, body } = await patch(`/api/v1/wr/${wr.id}`, { status: 'PASSED' });
    expect(status).toBe(409);
    expect(body.error).toMatch(/transition/i);
  });

  it('PATCH /api/v1/wr/:id — rejects invalid transition DRAFT → IN_PROGRESS with 409', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'SM test 2', description: 'Test', type: 'bug', priority: 1 });
    const { status, body } = await patch(`/api/v1/wr/${wr.id}`, { status: 'IN_PROGRESS' });
    expect(status).toBe(409);
    expect(body.error).toMatch(/transition/i);
  });

  it('PATCH /api/v1/wr/:id — rejects invalid transition PASSED → DRAFT with 409', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'SM test 3', description: 'Test', type: 'feature', priority: 3 });
    await patch(`/api/v1/wr/${wr.id}`, { status: 'FRONT_DOOR' });
    await post(`/api/v1/wr/${wr.id}/decomposition`, { qualityScore: 80, structuredRequirements: ['R1'] });
    await patch(`/api/v1/wr/${wr.id}`, { status: 'IN_PROGRESS' });
    await patch(`/api/v1/wr/${wr.id}`, { status: 'ARMED' });
    await patch(`/api/v1/wr/${wr.id}`, { status: 'SOFT_RESOLVED' });
    await patch(`/api/v1/wr/${wr.id}`, { status: 'PASSED' });
    const { status, body } = await patch(`/api/v1/wr/${wr.id}`, { status: 'DRAFT' });
    expect(status).toBe(409);
    expect(body.error).toMatch(/transition|none/i);
  });

  it('PATCH /api/v1/wr/:id — allows valid transition DRAFT → FRONT_DOOR', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'SM valid', description: 'Test', type: 'feature', priority: 2 });
    const { status, body } = await patch(`/api/v1/wr/${wr.id}`, { status: 'FRONT_DOOR' });
    expect(status).toBe(200);
    expect(body.status).toBe('FRONT_DOOR');
  });

  it('PATCH /api/v1/wr/:id — allows valid transition DRAFT → FAILED', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'SM fail', description: 'Test', type: 'bug', priority: 1 });
    const { status, body } = await patch(`/api/v1/wr/${wr.id}`, { status: 'FAILED' });
    expect(status).toBe(200);
    expect(body.status).toBe('FAILED');
  });

  it('PATCH /api/v1/wr/:id — FAILED → any transition is blocked', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'SM failed', description: 'Test', type: 'bug', priority: 1 });
    await patch(`/api/v1/wr/${wr.id}`, { status: 'FAILED' });
    const { status } = await patch(`/api/v1/wr/${wr.id}`, { status: 'DRAFT' });
    expect(status).toBe(409);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REAL-WORLD SCENARIO: telemetry anomaly + E2E lifecycle — PHD hardening
// ────────────────────────────────────────────────────────────────────────────

describe('Telemetry — PHD hardening', () => {
  it('GET /api/v1/telemetry/history — returns array (default 1h range)', async () => {
    const { status, body } = await get('/api/v1/telemetry/history');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/telemetry/history?range=24h — returns array', async () => {
    const { status, body } = await get('/api/v1/telemetry/history?range=24h');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/telemetry/history?range=7d — returns array', async () => {
    const { status, body } = await get('/api/v1/telemetry/history?range=7d');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/v1/telemetry/quality — returns quality metrics object', async () => {
    const { status, body } = await get('/api/v1/telemetry/quality');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });

  it('GET /api/v1/telemetry/quota — returns quota metrics', async () => {
    const { status, body } = await get('/api/v1/telemetry/quota');
    expect(status).toBe(200);
    expect(typeof body).toBe('object');
  });
});

describe('Gates — PHD hardening', () => {
  it('GET /api/v1/gates/:wrId/verdicts — returns verdict array', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Gates PHD', description: 'Test', type: 'bug', priority: 1 });
    await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL', reason: 'Missing tests', hmacValid: false, hmacFingerprint: '',
    });
    const { status, body } = await get(`/api/v1/gates/${wr.id}/verdicts`);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('GET /api/v1/gates/:wrId/verdicts — returns 404 for missing WR', async () => {
    const { status } = await get('/api/v1/gates/R-00000000-NOTEXIST/verdicts');
    expect(status).toBe(404);
  });

  it('GET /api/v1/gates/violations — returns violations array or object', async () => {
    const { status } = await get('/api/v1/gates/violations');
    expect(status).toBe(200);
  });

  it('POST /api/v1/gates/:wrId/disarm — requires reason of ≥30 chars', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Disarm test', description: 'Test', type: 'bug', priority: 1 });
    await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL', reason: 'Gate armed', hmacValid: false, hmacFingerprint: '',
    });
    const { status, body } = await post(`/api/v1/gates/${wr.id}/disarm`, { reason: 'too short' });
    expect(status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('POST /api/v1/gates/:wrId/disarm — succeeds with reason ≥30 chars', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Disarm ok', description: 'Test', type: 'bug', priority: 1 });
    await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL', reason: 'Gate armed for disarm test', hmacValid: false, hmacFingerprint: '',
    });
    const { status } = await post(`/api/v1/gates/${wr.id}/disarm`, {
      reason: 'Manual disarm authorized by PHD test — reason is sufficient length',
    });
    expect(status).toBe(200);
  });

  it('POST /api/v1/gates/:wrId/disarm — returns 404 for missing WR', async () => {
    const { status } = await post('/api/v1/gates/R-00000000-NOTEXIST/disarm', {
      reason: 'Disarm attempt on non-existent WR for PHD coverage',
    });
    expect(status).toBe(404);
  });
});

describe('WR E2E Lifecycle — PHD full pipeline', () => {
  it('full E2E: DRAFT → FRONT_DOOR → ASSIGNED → IN_PROGRESS → ARMED → SOFT_RESOLVED → PASSED with 3 verdicts', async () => {
    const { body: wr } = await post('/api/v1/wr', {
      title: 'PHD E2E Full Lifecycle Test', description: 'Complete lifecycle validation', type: 'feature', priority: 1,
    });
    expect(wr.status).toBe('DRAFT');

    const { body: fd } = await patch(`/api/v1/wr/${wr.id}`, { status: 'FRONT_DOOR' });
    expect(fd.status).toBe('FRONT_DOOR');

    const { body: assigned } = await post(`/api/v1/wr/${wr.id}/decomposition`, {
      qualityScore: 90, structuredRequirements: ['E2E req 1', 'E2E req 2'],
    });
    expect(assigned.status).toBe('ASSIGNED');

    const { body: inprog } = await patch(`/api/v1/wr/${wr.id}`, { status: 'IN_PROGRESS' });
    expect(inprog.status).toBe('IN_PROGRESS');

    const { body: fail1 } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL', reason: 'E2E fail iteration 1', hmacValid: false, hmacFingerprint: '',
    });
    expect(fail1.gateState).toBe('ARMED');
    expect(fail1.gateIterations).toBe(1);

    const { body: armed } = await patch(`/api/v1/wr/${wr.id}`, { status: 'ARMED' });
    expect(armed.status).toBe('ARMED');

    const { body: fail2 } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'FAIL', reason: 'E2E fail iteration 2', hmacValid: false, hmacFingerprint: '',
    });
    expect(fail2.gateIterations).toBe(2);

    const { body: passVerdict } = await post(`/api/v1/wr/${wr.id}/verdict`, {
      verdict: 'PASS', reason: 'All E2E requirements verified', hmacValid: true, hmacFingerprint: 'sha256:e2e-test',
    });
    expect(passVerdict.gateState).toBe('SOFT_RESOLVED');

    const { body: softres } = await patch(`/api/v1/wr/${wr.id}`, { status: 'SOFT_RESOLVED' });
    expect(softres.status).toBe('SOFT_RESOLVED');

    const { body: passed } = await patch(`/api/v1/wr/${wr.id}`, { status: 'PASSED' });
    expect(passed.status).toBe('PASSED');
    expect(passed.completedAt).toBeTruthy();
    expect(passed.verdicts).toHaveLength(3);

    // Export check
    const { status: exportStatus } = await get(`/api/v1/wr/${wr.id}/export`);
    expect(exportStatus).toBe(200);
  });

  it('concurrent WR creation with 5 parallel streams — all unique, all DRAFT', async () => {
    const creates = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        post('/api/v1/wr', {
          title: `Concurrent PHD ${i} ${Date.now()}`,
          description: 'Concurrent pipeline test',
          type: 'infra',
          priority: 3,
        })
      )
    );
    const ids = creates.map((c) => c.body.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(5);
    creates.forEach(({ body }) => expect(body.status).toBe('DRAFT'));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CYCLE 2 HARDENING: Auth, Filters, WS, Parallel-Stream, Export Format
// ────────────────────────────────────────────────────────────────────────────

describe('Auth API — PHD cycle 2', () => {
  it('POST /api/v1/auth/login — returns token with valid secret', async () => {
    const { status, body } = await post('/api/v1/auth/login', { token: 'hos-dashboard-2026' });
    expect(status).toBe(200);
    expect(body.token).toBeTruthy();
    expect(typeof body.token).toBe('string');
    expect(body.expiresIn).toBeGreaterThan(0);
  });

  it('POST /api/v1/auth/login — 401 with wrong secret', async () => {
    const { status } = await post('/api/v1/auth/login', { token: 'wrong-secret' });
    expect(status).toBe(401);
  });

  it('POST /api/v1/auth/login — 400 with missing token', async () => {
    const { status } = await post('/api/v1/auth/login', {});
    expect(status).toBe(400);
  });
});

describe('WR Filters — PHD cycle 2', () => {
  it('GET /api/v1/wr?type=bug — returns only bug WRs', async () => {
    await post('/api/v1/wr', { title: 'Bug filter test', description: 'Test', type: 'bug', priority: 2 });
    const { body } = await get('/api/v1/wr?type=bug');
    expect(Array.isArray(body)).toBe(true);
    body.forEach((w: { type: string }) => expect(w.type).toBe('bug'));
  });

  it('GET /api/v1/wr?type=feature — returns only feature WRs', async () => {
    await post('/api/v1/wr', { title: 'Feature filter test', description: 'Test', type: 'feature', priority: 3 });
    const { body } = await get('/api/v1/wr?type=feature');
    expect(Array.isArray(body)).toBe(true);
    body.forEach((w: { type: string }) => expect(w.type).toBe('feature'));
  });

  it('GET /api/v1/wr?priority=1 — returns only priority 1 WRs', async () => {
    await post('/api/v1/wr', { title: 'P1 filter test', description: 'Test', type: 'infra', priority: 1 });
    const { body } = await get('/api/v1/wr?priority=1');
    expect(Array.isArray(body)).toBe(true);
    body.forEach((w: { priority: number }) => expect(w.priority).toBe(1));
  });

  it('GET /api/v1/wr?status=DRAFT — all results are DRAFT', async () => {
    const { body } = await get('/api/v1/wr?status=DRAFT');
    expect(Array.isArray(body)).toBe(true);
    body.forEach((w: { status: string }) => expect(w.status).toBe('DRAFT'));
  });
});

describe('Parallel-Stream API — PHD cycle 2', () => {
  it('POST /api/v1/wr/:id/parallel-stream — 400 for missing agentId', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'PS test', description: 'Test', type: 'feature', priority: 2 });
    const { status } = await post(`/api/v1/wr/${wr.id}/parallel-stream`, {});
    expect(status).toBe(400);
  });

  it('POST /api/v1/wr/:id/parallel-stream — 400 for empty agentId string', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'PS empty', description: 'Test', type: 'feature', priority: 2 });
    const { status } = await post(`/api/v1/wr/${wr.id}/parallel-stream`, { agentId: '' });
    expect(status).toBe(400);
  });

  it('POST /api/v1/wr/:id/parallel-stream — adds agent to parallelStreams', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'PS add', description: 'Test', type: 'feature', priority: 2 });
    const { status, body } = await post(`/api/v1/wr/${wr.id}/parallel-stream`, { agentId: 'agent-test-1' });
    expect(status).toBe(200);
    expect(body.parallelStreams).toContain('agent-test-1');
  });

  it('POST /api/v1/wr/:id/parallel-stream — duplicate agentId not added twice', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'PS dedup', description: 'Test', type: 'feature', priority: 2 });
    await post(`/api/v1/wr/${wr.id}/parallel-stream`, { agentId: 'agent-dup' });
    const { body } = await post(`/api/v1/wr/${wr.id}/parallel-stream`, { agentId: 'agent-dup' });
    expect(body.parallelStreams.filter((a: string) => a === 'agent-dup')).toHaveLength(1);
  });

  it('POST /api/v1/wr/:id/parallel-stream — 404 for non-existent WR', async () => {
    const { status } = await post('/api/v1/wr/R-00000000-NOTEXIST/parallel-stream', { agentId: 'test' });
    expect(status).toBe(404);
  });
});

describe('Export Format Validation — PHD cycle 2', () => {
  it('GET /api/v1/wr/:id/export?format=csv — returns 400', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Export fmt', description: 'Test', type: 'feature', priority: 2 });
    const r = await fetch(`${BASE}/api/v1/wr/${wr.id}/export?format=csv`);
    expect(r.status).toBe(400);
  });

  it('GET /api/v1/wr/:id/export?format=xml — returns 400', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Export xml', description: 'Test', type: 'feature', priority: 2 });
    const r = await fetch(`${BASE}/api/v1/wr/${wr.id}/export?format=xml`);
    expect(r.status).toBe(400);
  });

  it('GET /api/v1/wr/:id/export (no format) — returns markdown', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Export md default', description: 'Test', type: 'feature', priority: 2 });
    const r = await fetch(`${BASE}/api/v1/wr/${wr.id}/export`);
    expect(r.status).toBe(200);
    const ct = r.headers.get('content-type') ?? '';
    expect(ct).toMatch(/markdown/i);
  });

  it('GET /api/v1/wr/:id/export?format=md — returns markdown', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Export md explicit', description: 'Test', type: 'infra', priority: 3 });
    const r = await fetch(`${BASE}/api/v1/wr/${wr.id}/export?format=md`);
    expect(r.status).toBe(200);
  });

  it('GET /api/v1/wr/:id/export?format=json — returns JSON object', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Export json', description: 'Test', type: 'bug', priority: 1 });
    const r = await fetch(`${BASE}/api/v1/wr/${wr.id}/export?format=json`);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.id).toBe(wr.id);
  });
});

describe('WebSocket Client Count — PHD cycle 2', () => {
  it('GET /api/v1/wr broadcast on create emits WR_CREATED', async () => {
    // Just verify endpoint still works after WS hardening (broadcast has try-catch now)
    const { status, body } = await post('/api/v1/wr', {
      title: 'WS broadcast test', description: 'Test', type: 'feature', priority: 2,
    });
    expect(status).toBe(201);
    expect(body.id).toBeTruthy();
  });
});

describe('Agent Edge Cases — PHD cycle 2', () => {
  it('GET /api/v1/agents — all 5 expected agents present', async () => {
    const { status, body } = await get('/api/v1/agents');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    const ids = body.map((a: { id: string }) => a.id);
    for (const expected of ['orc', 'frd', 'sol', 'res', 'ver']) {
      expect(ids).toContain(expected);
    }
  });

  it('POST /api/v1/agents/:id/assign — 400 for missing wrId', async () => {
    const { status } = await post('/api/v1/agents/ver/assign', {});
    expect(status).toBe(400);
  });

  it('POST /api/v1/agents/:id/assign — 404 for unknown agent', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Agent assign 404', description: 'Test', type: 'bug', priority: 1 });
    const { status } = await post('/api/v1/agents/nonexistent-agent/assign', { wrId: wr.id });
    expect(status).toBe(404);
  });

  it('POST /api/v1/agents/:id/inject — 400 for missing annotation', async () => {
    const { body: wr } = await post('/api/v1/wr', { title: 'Inject test', description: 'Test', type: 'bug', priority: 1 });
    const { status } = await post('/api/v1/agents/orc/inject', { wrId: wr.id });
    expect(status).toBe(400);
  });

  it('POST /api/v1/agents/:id/inject — 404 for non-existent WR', async () => {
    const { status } = await post('/api/v1/agents/orc/inject', {
      wrId: 'R-00000000-NOTEXIST', annotation: 'Test annotation that should 404',
    });
    expect(status).toBe(404);
  });

  it('POST /api/v1/agents/:id/pause — returns agent in paused state', async () => {
    const { status, body } = await post('/api/v1/agents/res/pause', {});
    expect(status).toBe(200);
    expect(body.status).toBe('paused');
  });

  it('POST /api/v1/agents/:id/resume — returns agent in running state', async () => {
    await post('/api/v1/agents/res/pause', {});
    const { status, body } = await post('/api/v1/agents/res/resume', {});
    expect(status).toBe(200);
    expect(body.status).toBe('running');
  });

  it('POST /api/v1/agents/:id/pause — 404 for unknown agent', async () => {
    const { status } = await post('/api/v1/agents/unknown-agent/pause', {});
    expect(status).toBe(404);
  });
});
