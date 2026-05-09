import db from '../db/db';

function parseAgent(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    model: row.model,
    tools: JSON.parse(row.tools as string),
    skills: JSON.parse(row.skills as string),
    currentWR: row.current_wr ?? null,
    status: row.status,
    iterationCount: row.iteration_count,
    lastActivityAt: row.last_activity_at,
    tokensUsedSession: row.tokens_used_session,
  };
}

export function listAgents() {
  return (db.prepare('SELECT * FROM agents ORDER BY name').all() as Record<string, unknown>[]).map(parseAgent);
}

export function getAgent(id: string) {
  const row = db.prepare('SELECT * FROM agents WHERE id=?').get(id) as Record<string, unknown> | undefined;
  return row ? parseAgent(row) : null;
}

export function assignWR(agentId: string, wrId: string) {
  if (!db.prepare('SELECT id FROM work_requests WHERE id=?').get(wrId)) return null;
  if (!db.prepare('SELECT id FROM agents WHERE id=?').get(agentId)) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE agents SET current_wr=?, status=?, last_activity_at=? WHERE id=?')
    .run(wrId, 'running', now, agentId);
  db.prepare('UPDATE work_requests SET assigned_agent=?, status=?, updated_at=? WHERE id=?')
    .run(agentId, 'IN_PROGRESS', now, wrId);
  return getAgent(agentId);
}

export function pauseAgent(agentId: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE agents SET status='paused', last_activity_at=? WHERE id=?").run(now, agentId);
  return getAgent(agentId);
}

export function resumeAgent(agentId: string) {
  const now = new Date().toISOString();
  db.prepare("UPDATE agents SET status='running', last_activity_at=? WHERE id=?").run(now, agentId);
  return getAgent(agentId);
}

export function terminateAgent(agentId: string) {
  const now = new Date().toISOString();
  const agent = getAgent(agentId);
  if (agent?.currentWR) {
    const row = db.prepare('SELECT status FROM work_requests WHERE id=?').get(agent.currentWR) as { status: string } | undefined;
    if (row && !['PASSED', 'FAILED'].includes(row.status)) {
      db.prepare("UPDATE work_requests SET status='FAILED', updated_at=? WHERE id=?")
        .run(now, agent.currentWR);
    }
  }
  db.prepare("UPDATE agents SET status='idle', current_wr=NULL, last_activity_at=? WHERE id=?").run(now, agentId);
  return getAgent(agentId);
}

export function injectAnnotation(agentId: string, wrId: string, annotation: string) {
  const now = new Date().toISOString();
  const wr = db.prepare('SELECT annotations, trace FROM work_requests WHERE id=?').get(wrId) as
    | { annotations: string; trace: string }
    | undefined;
  if (!wr) return null;

  const annotations = JSON.parse(wr.annotations);
  annotations.push(annotation);

  const trace = JSON.parse(wr.trace);
  trace.push({
    stepId: `step-${Date.now()}`,
    type: 'human_annotation',
    agentId,
    description: annotation,
    timestamp: now,
  });

  db.prepare('UPDATE work_requests SET annotations=?, trace=?, updated_at=? WHERE id=?')
    .run(JSON.stringify(annotations), JSON.stringify(trace), now, wrId);

  db.prepare('UPDATE agents SET last_activity_at=? WHERE id=?').run(now, agentId);
  return { wrId, annotation, timestamp: now };
}

export function incrementIterationCount(agentId: string, tokens = 0) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE agents
    SET iteration_count = iteration_count + 1,
        tokens_used_session = tokens_used_session + ?,
        last_activity_at = ?
    WHERE id = ?
  `).run(tokens, now, agentId);
}
