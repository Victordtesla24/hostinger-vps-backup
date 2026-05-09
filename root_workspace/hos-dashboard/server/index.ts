import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env before any other imports that read process.env
const envPath = resolve(process.cwd(), '.env');
try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env optional */ }

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';

import { wrRoutes } from './routes/wr.routes';
import { agentsRoutes } from './routes/agents.routes';
import { telemetryRoutes } from './routes/telemetry.routes';
import { gatesRoutes } from './routes/gates.routes';
import { cronRoutes } from './routes/cron.routes';
import { registerClient, broadcast } from './websocket/hub';
import { startStateWatcher, stateEvents } from './services/stateWatcher.service';
import { collectTelemetry } from './services/telemetry.service';
import { getGlobalGateState } from './services/gate.service';
import { registerAuditMiddleware } from './middleware/audit';
import { authHook } from './middleware/auth';
import { authRoutes } from './routes/auth.routes';

const PORT = parseInt(process.env.PORT ?? '8080');

async function main() {
  const app = Fastify({ logger: { level: 'warn' } });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  registerAuditMiddleware(app);

  // Public endpoints (no auth required)
  app.get('/api/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

  // Auth routes (unprotected — login endpoint)
  await app.register(authRoutes);

  // Apply auth middleware to all subsequent routes
  app.addHook('preHandler', authHook);

  await app.register(wrRoutes);
  await app.register(agentsRoutes);
  await app.register(telemetryRoutes);
  await app.register(gatesRoutes);
  await app.register(cronRoutes);

  // Initialize Fastify (plugins, routes) but don't listen yet
  await app.ready();

  // Attach WebSocket server to Fastify's underlying http.Server
  const wss = new WebSocketServer({ server: app.server });

  wss.on('connection', (ws) => {
    registerClient(ws);
    ws.send(JSON.stringify({ event: 'CONNECTED', data: { ts: new Date().toISOString() } }));
  });

  // Wire state file changes → WebSocket broadcasts
  stateEvents.on('gate_log_changed', () => {
    broadcast('GATE_LOG_UPDATED', { ts: new Date().toISOString() });
  });
  stateEvents.on('gate_state_changed', () => {
    broadcast('GLOBAL_GATE_STATE', getGlobalGateState());
  });
  stateEvents.on('violation_recorded', () => {
    broadcast('VIOLATION_RECORDED', { ts: new Date().toISOString() });
  });

  // Telemetry broadcast + anomaly detection every 5s
  setInterval(async () => {
    try {
      const bundle = await collectTelemetry();
      broadcast('TELEMETRY_SNAPSHOT', bundle);

      if (bundle.vps.cpuPercent > 90)
        broadcast('ALERT', { type: 'cpu', message: `CPU at ${bundle.vps.cpuPercent}%`, severity: 'critical', timestamp: new Date().toISOString() });
      if (bundle.vps.ramPercent > 85)
        broadcast('ALERT', { type: 'ram', message: `RAM at ${bundle.vps.ramPercent}%`, severity: 'critical', timestamp: new Date().toISOString() });
      if (bundle.quota.projectedExhaustionHours !== null && bundle.quota.projectedExhaustionHours < 2)
        broadcast('ALERT', { type: 'quota', message: `Quota exhausts in ${bundle.quota.projectedExhaustionHours.toFixed(1)}h`, severity: 'critical', timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('[telemetry] poll error:', (err as Error).message);
    }
  }, 5000);

  startStateWatcher();

  // Start listening — this binds app.server to PORT
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[HOS API] listening on http://0.0.0.0:${PORT}`);
}

main().catch((err) => {
  console.error('[HOS API] fatal:', err);
  process.exit(1);
});
