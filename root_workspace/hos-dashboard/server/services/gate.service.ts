import { writeFileSync, existsSync, appendFileSync } from 'fs';
import { readGateLocalState, readGateLog, readViolations } from '../lib/stateFileParser';
import db from '../db/db';

const GATE_LOCAL = process.env.HOS_GATE_LOCAL ?? '/root/.opencode/state/ralph-loop-infinite.local';
const GATE_LOG = process.env.HOS_GATE_LOG ?? '/root/.opencode/state/ralph-gate.log';

export function getGateStateForWR(wrId: string) {
  const wr = db.prepare('SELECT gate_state, gate_iterations, verdicts FROM work_requests WHERE id=?').get(wrId) as {
    gate_state: string;
    gate_iterations: number;
    verdicts: string;
  } | undefined;
  if (!wr) return null;

  const verdicts = JSON.parse(wr.verdicts) as object[];
  const global = readGateLocalState();

  return {
    wrId,
    state: wr.gate_state,
    iterations: wr.gate_iterations,
    verdicts,
    globalGateActive: global.active,
    globalVerifierAttempts: global.verifier_attempts,
    globalVerifierPass: global.verifier_pass,
  };
}

export function getAllActiveGates() {
  const rows = db.prepare(
    "SELECT id, title, gate_state, gate_iterations, verdicts, updated_at FROM work_requests WHERE gate_state='ARMED'"
  ).all() as { id: string; title: string; gate_state: string; gate_iterations: number; verdicts: string; updated_at: string }[];

  return rows.map((r) => ({
    wrId: r.id,
    title: r.title,
    state: r.gate_state,
    iterations: r.gate_iterations,
    verdicts: JSON.parse(r.verdicts),
    lastActivity: r.updated_at,
  }));
}

export function disarmGate(wrId: string, reason: string): { success: boolean; error?: string } {
  if (reason.length < 30) {
    return { success: false, error: 'Reason must be at least 30 characters' };
  }

  db.prepare(
    "UPDATE work_requests SET gate_state='DISARMED', updated_at=? WHERE id=?"
  ).run(new Date().toISOString(), wrId);

  const logLine = `[${new Date().toISOString()}] [manual-disarm] WR=${wrId} reason="${reason}"\n`;
  if (existsSync(GATE_LOG)) {
    appendFileSync(GATE_LOG, logLine);
  }

  return { success: true };
}

export function getGateLog(lastN = 100) {
  return readGateLog(lastN);
}

export function getViolations(lastN = 50) {
  return readViolations(lastN);
}

export function getGlobalGateState() {
  return readGateLocalState();
}
