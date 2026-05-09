import { readFileSync, existsSync } from 'fs';

const GATE_LOCAL = process.env.HOS_GATE_LOCAL ?? '/root/.opencode/state/ralph-loop-infinite.local';
const GATE_LOG = process.env.HOS_GATE_LOG ?? '/root/.opencode/state/ralph-gate.log';
const VIOLATIONS = process.env.HOS_VIOLATIONS ?? '/root/.opencode/state/violations.jsonl';

export interface GateLocalState {
  active: boolean;
  session_id: string;
  started_at: string;
  verifier_attempts: number;
  verifier_pass: boolean;
  armed_by?: string;
  trigger?: string;
}

export function readGateLocalState(): GateLocalState {
  if (!existsSync(GATE_LOCAL)) {
    return { active: false, session_id: '', started_at: '', verifier_attempts: 0, verifier_pass: false };
  }
  const raw = readFileSync(GATE_LOCAL, 'utf8');
  const result: Record<string, string | boolean | number> = {};
  for (const line of raw.split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (val === 'true') result[key] = true;
    else if (val === 'false') result[key] = false;
    else if (!isNaN(Number(val)) && val !== '') result[key] = Number(val);
    else result[key] = val;
  }
  return {
    active: (result.active as boolean) ?? false,
    session_id: (result.session_id as string) ?? '',
    started_at: (result.started_at as string) ?? '',
    verifier_attempts: (result.verifier_attempts as number) ?? 0,
    verifier_pass: (result.verifier_pass as boolean) ?? false,
    armed_by: result.armed_by as string,
    trigger: result.trigger as string,
  };
}

export interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
  raw: string;
}

export function readGateLog(lastN = 200): LogEntry[] {
  if (!existsSync(GATE_LOG)) return [];
  const lines = readFileSync(GATE_LOG, 'utf8').split('\n').filter(Boolean);
  const recent = lines.slice(-lastN);
  return recent.map((raw) => {
    const tsMatch = raw.match(/^\[([^\]]+)\]/);
    const timestamp = tsMatch ? tsMatch[1] : '';
    let type = 'info';
    if (raw.includes('BLOCK')) type = 'block';
    else if (raw.includes('PASS')) type = 'pass';
    else if (raw.includes('FAIL')) type = 'fail';
    else if (raw.includes('STOP')) type = 'stop';
    else if (raw.includes('session')) type = 'session';
    return { timestamp, type, message: raw.replace(/^\[[^\]]+\]\s*/, ''), raw };
  });
}

export interface ViolationRecord {
  ts: string;
  sessionId: string;
  type: string;
}

export function readViolations(lastN = 50): ViolationRecord[] {
  if (!existsSync(VIOLATIONS)) return [];
  const lines = readFileSync(VIOLATIONS, 'utf8').split('\n').filter(Boolean);
  const recent = lines.slice(-lastN);
  const result: ViolationRecord[] = [];
  let buf = '';
  for (const line of recent) {
    buf += line;
    try {
      const obj = JSON.parse(buf);
      result.push(obj as ViolationRecord);
      buf = '';
    } catch {
      // accumulate multi-line JSON
    }
  }
  return result;
}

export function computeQualityMetrics(db: import('better-sqlite3').Database) {
  const total = (db.prepare('SELECT COUNT(*) as c FROM gate_verdicts').get() as { c: number }).c;
  const passes = (db.prepare("SELECT COUNT(*) as c FROM gate_verdicts WHERE verdict='PASS'").get() as { c: number }).c;
  const passRate = total === 0 ? 100 : Math.round((passes / total) * 100);

  const avgIter = (db.prepare(
    "SELECT AVG(iteration) as a FROM gate_verdicts WHERE verdict='PASS'"
  ).get() as { a: number | null }).a ?? 1;

  const activeGates = (db.prepare(
    "SELECT COUNT(*) as c FROM work_requests WHERE gate_state='ARMED'"
  ).get() as { c: number }).c;

  const failRows = db.prepare(
    "SELECT reason FROM gate_verdicts WHERE verdict='FAIL'"
  ).all() as { reason: string }[];

  const histogram: Record<string, number> = {};
  for (const row of failRows) {
    const key = row.reason.slice(0, 40);
    histogram[key] = (histogram[key] ?? 0) + 1;
  }

  return {
    gatePassRatePercent: passRate,
    avgIterationsToPass: Math.round(avgIter * 10) / 10,
    activeGates,
    failReasonsHistogram: histogram,
    totalVerifications: total,
  };
}
