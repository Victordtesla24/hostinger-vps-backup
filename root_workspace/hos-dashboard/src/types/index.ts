export type WRStatus =
  | 'DRAFT'
  | 'FRONT_DOOR'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'VERIFICATION'
  | 'PASSED'
  | 'FAILED';

export type GateState = 'ARMED' | 'SOFT_RESOLVED' | 'DISARMED';

export type AgentStatus = 'idle' | 'running' | 'blocked' | 'failed' | 'paused';

export interface DecompositionResult {
  qualityScore: number;               // 0-100
  structuredRequirements: string[];
  acceptanceCriteria: string[];
  ambiguityFlags: string[];
  missingContextWarnings: string[];
  rawOutput: string;
  timestamp: string;
}

export interface VerifierVerdict {
  iteration: number;
  verdict: 'PASS' | 'FAIL';
  reason: string;
  hmacValid: boolean;
  hmacFingerprint: string;
  timestamp: string;
}

export interface ExecutionStep {
  stepId: string;
  type: 'tool_call' | 'reasoning' | 'output' | 'human_annotation' | 'gate_check';
  agentId: string;
  description: string;
  result?: string;
  timestamp: string;
  durationMs?: number;
}

export interface WorkRequest {
  id: string;                         // R-YYYYMMDD-xxxxxxxx
  title: string;
  description: string;
  type: 'feature' | 'bug' | 'research' | 'infra';
  priority: 1 | 2 | 3 | 4 | 5;
  status: WRStatus;
  assignedAgent: string | null;
  parallelStreams: string[];
  decomposition: DecompositionResult | null;
  gateState: GateState;
  gateIterations: number;
  verdicts: VerifierVerdict[];
  trace: ExecutionStep[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  annotations?: string[];
}

export interface AgentPersona {
  id: string;
  name: string;
  role:
    | 'orchestrator'
    | 'solution_designer'
    | 'research'
    | 'front_door'
    | 'verifier'
    | 'specialist';
  model: string;
  tools: string[];
  skills: string[];
  currentWR: string | null;
  status: AgentStatus;
  iterationCount: number;
  lastActivityAt: string;
  tokensUsedSession: number;
}

export interface VPSMetrics {
  cpuPercent: number;
  ramPercent: number;
  ramUsedGB: number;
  ramTotalGB: number;
  diskPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  netInMBps: number;
  netOutMBps: number;
  uptime: string;
  processCount: number;
  loadAvg: [number, number, number];
  provenance?: string;
}

export interface QuotaMetrics {
  tokensUsedToday: number;
  tokensDailyLimit: number;
  burnRatePerHour: number;
  projectedExhaustionHours: number | null;
  requestsUsedToday: number;
  sessionCount: number;
}

export interface PipelineMetrics {
  wrCompletedPerHour: number;
  avgCycleTimeMinutes: number;
  p50CycleTimeMinutes: number;
  p95CycleTimeMinutes: number;
  activeWRs: number;
  queuedWRs: number;
  stalledWRs: number;
  stageBreakdown: Record<string, number>;
}

export interface QualityMetrics {
  gatePassRatePercent: number;
  avgIterationsToPass: number;
  activeGates: number;
  failReasonsHistogram: Record<string, number>;
  totalVerifications: number;
}

export interface GateRecord {
  wrId: string;
  state: GateState;
  iterations: number;
  verdicts: VerifierVerdict[];
  lastActivity: string;
  hmacKeyFingerprint: string;
}

export interface RalphState {
  active: boolean;
  session_id?: string;
  started_at?: string;
  verifier_attempts: number;
  verifier_pass: boolean;
  contract?: string;
  recentVerdicts: VerifierVerdict[];
  violations: number;
  logLines: string[];
}

export interface Alert {
  id: string;
  type: 'cpu' | 'ram' | 'quota' | 'agent_failed' | 'gate_armed';
  message: string;
  severity: 'warning' | 'critical';
  timestamp: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  source: 'hermes' | 'os';
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  description: string;
  logFile?: string;
}

export type NavPage =
  | 'dashboard'
  | 'work-requests'
  | 'agents'
  | 'quality-gates'
  | 'telemetry'
  | 'cron-jobs';
