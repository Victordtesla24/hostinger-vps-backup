import db from '../db/db';

function genId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `R-${date}-${rand}`;
}

export interface CreateWRInput {
  title: string;
  description: string;
  type: 'feature' | 'bug' | 'research' | 'infra';
  priority: 1 | 2 | 3 | 4 | 5;
}

export interface UpdateWRInput {
  title?: string;
  description?: string;
  status?: string;
  assignedAgent?: string | null;
  gateState?: string;
  annotations?: string[];
  decomposition?: object | null;
}

function parseWR(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    type: row.type as string,
    priority: row.priority as number,
    status: row.status as string,
    assignedAgent: (row.assigned_agent ?? null) as string | null,
    parallelStreams: JSON.parse(row.parallel_streams as string) as string[],
    decomposition: row.decomposition ? JSON.parse(row.decomposition as string) : null,
    gateState: row.gate_state as string,
    gateIterations: row.gate_iterations as number,
    verdicts: JSON.parse(row.verdicts as string) as unknown[],
    trace: JSON.parse(row.trace as string) as unknown[],
    annotations: JSON.parse(row.annotations as string) as string[],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at ?? null) as string | null,
  };
}

export function listWRs(filters: { status?: string; agent?: string; priority?: number; type?: string }) {
  let query = 'SELECT * FROM work_requests WHERE 1=1';
  const params: unknown[] = [];
  if (filters.status) { query += ' AND status=?'; params.push(filters.status); }
  if (filters.agent) { query += ' AND assigned_agent=?'; params.push(filters.agent); }
  if (filters.priority) { query += ' AND priority=?'; params.push(filters.priority); }
  if (filters.type) { query += ' AND type=?'; params.push(filters.type); }
  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];
  return rows.map(parseWR);
}

export function getWR(id: string) {
  const row = db.prepare('SELECT * FROM work_requests WHERE id=?').get(id) as Record<string, unknown> | undefined;
  return row ? parseWR(row) : null;
}

export function createWR(input: CreateWRInput) {
  const id = genId();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO work_requests (id, title, description, type, priority, status, assigned_agent, parallel_streams,
      decomposition, gate_state, gate_iterations, verdicts, trace, annotations, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, 'DRAFT', NULL, '[]', NULL, 'DISARMED', 0, '[]', '[]', '[]', ?, ?, NULL)
  `).run(id, input.title, input.description, input.type, input.priority, now, now);
  return getWR(id)!;
}

export function updateWR(id: string, input: UpdateWRInput) {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at=?'];
  const params: unknown[] = [now];

  if (input.title !== undefined) { fields.push('title=?'); params.push(input.title); }
  if (input.description !== undefined) { fields.push('description=?'); params.push(input.description); }
  if (input.status !== undefined) {
    fields.push('status=?');
    params.push(input.status);
    if (input.status === 'PASSED' || input.status === 'FAILED') {
      fields.push('completed_at=?');
      params.push(now);
    }
  }
  if (input.assignedAgent !== undefined) { fields.push('assigned_agent=?'); params.push(input.assignedAgent); }
  if (input.gateState !== undefined) { fields.push('gate_state=?'); params.push(input.gateState); }
  if (input.annotations !== undefined) { fields.push('annotations=?'); params.push(JSON.stringify(input.annotations)); }
  if (input.decomposition !== undefined) { fields.push('decomposition=?'); params.push(input.decomposition ? JSON.stringify(input.decomposition) : null); }

  params.push(id);
  db.prepare(`UPDATE work_requests SET ${fields.join(',')} WHERE id=?`).run(...params);
  return getWR(id);
}

export function archiveWR(id: string) {
  updateWR(id, { status: 'FAILED' });
  return { archived: true };
}

export function addTraceStep(wrId: string, step: object) {
  const wr = getWR(wrId);
  if (!wr) return null;
  const trace = [...wr.trace, step];
  db.prepare('UPDATE work_requests SET trace=?, updated_at=? WHERE id=?')
    .run(JSON.stringify(trace), new Date().toISOString(), wrId);
  return getWR(wrId);
}

export function addVerdict(wrId: string, verdict: { verdict: string; reason: string; hmacValid: boolean; hmacFingerprint: string }) {
  const wr = getWR(wrId);
  if (!wr) return null;

  const iteration = wr.gateIterations + 1;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO gate_verdicts (wr_id, iteration, verdict, reason, hmac_valid, hmac_fingerprint, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(wrId, iteration, verdict.verdict, verdict.reason, verdict.hmacValid ? 1 : 0, verdict.hmacFingerprint, now);

  const verdictObj = { iteration, ...verdict, timestamp: now };
  const verdicts = [...wr.verdicts, verdictObj];
  const newGateState = verdict.verdict === 'PASS' ? 'SOFT_RESOLVED' : 'ARMED';

  db.prepare('UPDATE work_requests SET verdicts=?, gate_iterations=?, gate_state=?, updated_at=? WHERE id=?')
    .run(JSON.stringify(verdicts), iteration, newGateState, now, wrId);

  return getWR(wrId);
}

export function spawnParallelStream(wrId: string, agentId: string) {
  const wr = getWR(wrId);
  if (!wr) return null;
  const streams = [...wr.parallelStreams];
  if (!streams.includes(agentId)) streams.push(agentId);
  db.prepare('UPDATE work_requests SET parallel_streams=?, updated_at=? WHERE id=?')
    .run(JSON.stringify(streams), new Date().toISOString(), wrId);
  return getWR(wrId);
}

export function exportWRAsMarkdown(id: string): string {
  const wr = getWR(id);
  if (!wr) return '';
  const lines: string[] = [
    `# Work Request: ${wr.id}`,
    '',
    `**Title:** ${wr.title}`,
    `**Type:** ${wr.type} | **Priority:** P${wr.priority} | **Status:** ${wr.status}`,
    `**Created:** ${wr.createdAt} | **Completed:** ${wr.completedAt ?? 'N/A'}`,
    '',
    '## Description',
    '',
    wr.description,
    '',
  ];

  if (wr.decomposition) {
    const d = wr.decomposition as Record<string, unknown>;
    lines.push('## Front Door Decomposition', '');
    lines.push(`**Quality Score:** ${d.qualityScore}%`);
    const reqs = (d.structuredRequirements as string[]) ?? [];
    lines.push('', '### Structured Requirements', '');
    reqs.forEach((r: string, i: number) => lines.push(`${i + 1}. ${r}`));
  }

  if ((wr.verdicts as unknown[]).length > 0) {
    lines.push('', '## Verifier Verdicts', '');
    for (const v of wr.verdicts as Record<string, unknown>[]) {
      lines.push(`- **Iteration ${v.iteration}:** ${v.verdict} — ${v.reason} (HMAC: ${v.hmacValid ? '✓ VALID' : '✗ INVALID'})`);
    }
  }

  if ((wr.trace as unknown[]).length > 0) {
    lines.push('', '## Execution Trace', '');
    for (const s of wr.trace as Record<string, unknown>[]) {
      lines.push(`- [${s.timestamp}] **${s.type}** (${s.agentId}): ${s.description}`);
    }
  }

  if ((wr.annotations as string[]).length > 0) {
    lines.push('', '## Human Annotations', '');
    (wr.annotations as string[]).forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  }

  return lines.join('\n');
}
