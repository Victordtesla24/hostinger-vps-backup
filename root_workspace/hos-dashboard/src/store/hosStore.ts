import { create } from 'zustand';
import type {
  WorkRequest, AgentPersona, VPSMetrics, QuotaMetrics,
  PipelineMetrics, QualityMetrics, GateRecord, Alert, NavPage, RalphState,
  CronJob
} from '../types';

interface HOSStore {
  // Navigation
  currentPage: NavPage;
  setPage: (page: NavPage) => void;

  // Cron Jobs
  cronJobs: CronJob[];
  setCronJobs: (jobs: CronJob[]) => void;
  upsertCronJob: (job: CronJob) => void;

  // Work Requests
  workRequests: WorkRequest[];
  selectedWR: WorkRequest | null;
  setWorkRequests: (wrs: WorkRequest[]) => void;
  upsertWR: (wr: WorkRequest) => void;
  removeWR: (id: string) => void;
  selectWR: (wr: WorkRequest | null) => void;

  // Agents
  agents: AgentPersona[];
  setAgents: (agents: AgentPersona[]) => void;
  upsertAgent: (agent: AgentPersona) => void;

  // Telemetry
  vpsMetrics: VPSMetrics | null;
  quotaMetrics: QuotaMetrics | null;
  pipelineMetrics: PipelineMetrics | null;
  qualityMetrics: QualityMetrics | null;
  setVPSMetrics: (m: VPSMetrics) => void;
  setQuotaMetrics: (m: QuotaMetrics) => void;
  setPipelineMetrics: (m: PipelineMetrics) => void;
  setQualityMetrics: (m: QualityMetrics) => void;

  // Gates
  gateRecords: GateRecord[];
  globalGateState: RalphState | null;
  setGateRecords: (records: GateRecord[]) => void;
  setGlobalGateState: (state: RalphState) => void;

  // Alerts
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  dismissAlert: (id: string) => void;

  // WebSocket
  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;

  // UI state
  wrFilter: { status?: string; priority?: number; type?: string; agent?: string };
  setWrFilter: (f: Partial<HOSStore['wrFilter']>) => void;
}

export const useHOSStore = create<HOSStore>((set) => ({
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),

  cronJobs: [],
  setCronJobs: (cronJobs) => set({ cronJobs }),
  upsertCronJob: (job) => set((s) => {
    const idx = s.cronJobs.findIndex((j) => j.id === job.id);
    const updated = idx >= 0
      ? [...s.cronJobs.slice(0, idx), job, ...s.cronJobs.slice(idx + 1)]
      : [job, ...s.cronJobs];
    return { cronJobs: updated };
  }),

  workRequests: [],
  selectedWR: null,
  setWorkRequests: (workRequests) => set({ workRequests }),
  upsertWR: (wr) => set((s) => {
    const idx = s.workRequests.findIndex((w) => w.id === wr.id);
    const updated = idx >= 0
      ? [...s.workRequests.slice(0, idx), wr, ...s.workRequests.slice(idx + 1)]
      : [wr, ...s.workRequests];
    const selectedWR = s.selectedWR?.id === wr.id ? wr : s.selectedWR;
    return { workRequests: updated, selectedWR };
  }),
  removeWR: (id) => set((s) => ({
    workRequests: s.workRequests.filter((w) => w.id !== id),
    selectedWR: s.selectedWR?.id === id ? null : s.selectedWR,
  })),
  selectWR: (selectedWR) => set({ selectedWR }),

  agents: [],
  setAgents: (agents) => set({ agents }),
  upsertAgent: (agent) => set((s) => {
    const idx = s.agents.findIndex((a) => a.id === agent.id);
    const updated = idx >= 0
      ? [...s.agents.slice(0, idx), agent, ...s.agents.slice(idx + 1)]
      : [...s.agents, agent];
    return { agents: updated };
  }),

  vpsMetrics: null,
  quotaMetrics: null,
  pipelineMetrics: null,
  qualityMetrics: null,
  setVPSMetrics: (vpsMetrics) => set({ vpsMetrics }),
  setQuotaMetrics: (quotaMetrics) => set({ quotaMetrics }),
  setPipelineMetrics: (pipelineMetrics) => set({ pipelineMetrics }),
  setQualityMetrics: (qualityMetrics) => set({ qualityMetrics }),

  gateRecords: [],
  globalGateState: null,
  setGateRecords: (gateRecords) => set({ gateRecords }),
  setGlobalGateState: (globalGateState) => set({ globalGateState }),

  alerts: [],
  addAlert: (alert) => set((s) => {
    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAlert: Alert = { id, ...alert };
    // Deduplicate by type — only keep most recent per type
    const filtered = s.alerts.filter((a) => a.type !== alert.type);
    return { alerts: [...filtered, newAlert].slice(-10) };
  }),
  dismissAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),

  wsConnected: false,
  setWsConnected: (wsConnected) => set({ wsConnected }),

  wrFilter: {},
  setWrFilter: (f) => set((s) => ({ wrFilter: { ...s.wrFilter, ...f } })),
}));
