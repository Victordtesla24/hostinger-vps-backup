import { useHOSStore } from './hosStore';
import type { WorkRequest, AgentPersona, Alert } from '../types';

const WS_URL = `ws://${window.location.hostname}:8080`;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (ws && ws.readyState < 2) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    useHOSStore.getState().setWsConnected(true);
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onclose = () => {
    useHOSStore.getState().setWsConnected(false);
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    ws?.close();
  };

  ws.onmessage = (event) => {
    let msg: { event: string; data: unknown; ts: string };
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      return;
    }

    const store = useHOSStore.getState();

    switch (msg.event) {
      case 'WR_CREATED':
      case 'WR_UPDATED':
      case 'WR_DECOMPOSED':
        store.upsertWR(msg.data as WorkRequest);
        break;

      case 'WR_ARCHIVED':
        store.removeWR((msg.data as { id: string }).id);
        break;

      case 'AGENT_ASSIGNED':
      case 'AGENT_PAUSED':
      case 'AGENT_RESUMED':
      case 'AGENT_TERMINATED':
        fetchAgents();
        break;

      case 'TELEMETRY_SNAPSHOT': {
        const bundle = msg.data as {
          vps: Parameters<typeof store.setVPSMetrics>[0];
          pipeline: Parameters<typeof store.setPipelineMetrics>[0];
          quota: Parameters<typeof store.setQuotaMetrics>[0];
          quality: Parameters<typeof store.setQualityMetrics>[0];
        };
        store.setVPSMetrics(bundle.vps);
        store.setPipelineMetrics(bundle.pipeline);
        store.setQuotaMetrics(bundle.quota);
        store.setQualityMetrics(bundle.quality);
        break;
      }

      case 'ALERT':
        store.addAlert(msg.data as Omit<Alert, 'id'>);
        break;

      case 'GATE_PASSED':
      case 'GATE_FAIL':
      case 'GATE_DISARMED':
        fetchWRs();
        fetchGates();
        break;

      case 'GLOBAL_GATE_STATE':
        store.setGlobalGateState(msg.data as Parameters<typeof store.setGlobalGateState>[0]);
        break;

      case 'ANNOTATION_INJECTED':
      case 'PARALLEL_STREAM_SPAWNED':
      case 'WR_TRACE_STEP':
        fetchWRs();
        break;

      case 'CRON_JOB_CREATED':
        fetchCronJobs();
        break;

      case 'AGENT_FAILED':
        store.addAlert({
          type: 'agent_failed',
          message: `Agent FAILED: ${(msg.data as { agentId: string }).agentId}`,
          severity: 'critical',
          timestamp: msg.ts,
        });
        store.upsertAgent(msg.data as AgentPersona);
        break;
    }
  };
}

async function fetchWRs() {
  try {
    const r = await fetch('/api/v1/wr');
    const wrs = await r.json() as WorkRequest[];
    useHOSStore.getState().setWorkRequests(wrs);
  } catch { /* network error — retry handled by WS reconnect */ }
}

async function fetchAgents() {
  try {
    const r = await fetch('/api/v1/agents');
    const agents = await r.json() as AgentPersona[];
    useHOSStore.getState().setAgents(agents);
  } catch { /* ignore */ }
}

async function fetchGates() {
  try {
    const r = await fetch('/api/v1/gates/active');
    useHOSStore.getState().setGateRecords(await r.json());
    const g = await fetch('/api/v1/gates/global');
    useHOSStore.getState().setGlobalGateState(await g.json());
  } catch { /* ignore */ }
}

async function fetchCronJobs() {
  try {
    const r = await fetch('/api/v1/cron/jobs');
    const jobs = await r.json();
    useHOSStore.getState().setCronJobs(jobs);
  } catch { /* ignore */ }
}

export async function initWS() {
  await fetchWRs();
  await fetchAgents();
  await fetchGates();
  await fetchCronJobs();
  connect();
}
