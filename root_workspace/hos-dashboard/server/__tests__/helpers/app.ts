import Database from 'better-sqlite3';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { wrRoutes } from '../../routes/wr.routes.js';
import { agentsRoutes } from '../../routes/agents.routes.js';
import { telemetryRoutes } from '../../routes/telemetry.routes.js';
import { gatesRoutes } from '../../routes/gates.routes.js';
import { cronRoutes } from '../../routes/cron.routes.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS work_requests (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  type TEXT NOT NULL, priority INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT',
  assigned_agent TEXT, parallel_streams TEXT NOT NULL DEFAULT '[]',
  decomposition TEXT, gate_state TEXT NOT NULL DEFAULT 'DISARMED',
  gate_iterations INTEGER NOT NULL DEFAULT 0, verdicts TEXT NOT NULL DEFAULT '[]',
  trace TEXT NOT NULL DEFAULT '[]', annotations TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, model TEXT NOT NULL,
  tools TEXT NOT NULL DEFAULT '[]', skills TEXT NOT NULL DEFAULT '[]',
  current_wr TEXT, status TEXT NOT NULL DEFAULT 'idle',
  iteration_count INTEGER NOT NULL DEFAULT 0, last_activity_at TEXT NOT NULL,
  tokens_used_session INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL,
  vps_data TEXT NOT NULL, pipeline_data TEXT NOT NULL,
  quota_data TEXT NOT NULL, quality_data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gate_verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, wr_id TEXT NOT NULL,
  iteration INTEGER NOT NULL, verdict TEXT NOT NULL, reason TEXT NOT NULL,
  hmac_valid INTEGER NOT NULL DEFAULT 1, hmac_fingerprint TEXT NOT NULL DEFAULT '',
  timestamp TEXT NOT NULL
);
`;

const SEED_AGENTS = `
INSERT INTO agents (id, name, role, model, tools, skills, current_wr, status, iteration_count, last_activity_at, tokens_used_session)
VALUES
  ('orc', 'HOS Orchestrator', 'orchestrator', 'claude-opus-4-7', '["Bash","Read","Write"]', '["ralph-loop-infinite"]', NULL, 'idle', 0, datetime('now'), 0),
  ('frd', 'Front Door', 'front_door', 'claude-sonnet-4-6', '["Read","Bash"]', '["ce-plan"]', NULL, 'idle', 0, datetime('now'), 0),
  ('sol', 'Solution Designer', 'solution_designer', 'claude-sonnet-4-6', '["WebSearch"]', '["ce-ideate"]', NULL, 'idle', 0, datetime('now'), 0),
  ('res', 'Research Agent', 'research', 'claude-sonnet-4-6', '["WebSearch"]', '["ce-best-practices-researcher"]', NULL, 'idle', 0, datetime('now'), 0),
  ('ver', 'Verifier Agent', 'verifier', 'claude-opus-4-7', '["Read","Bash"]', '["ralph-loop"]', NULL, 'idle', 0, datetime('now'), 0);
`;

// Module-level DB singleton for test isolation via beforeEach reset
let _testDb: Database.Database | null = null;

export function getTestDb(): Database.Database {
  if (!_testDb) {
    _testDb = new Database(':memory:');
    _testDb.pragma('journal_mode = WAL');
    _testDb.pragma('foreign_keys = ON');
  }
  return _testDb;
}

export function resetTestDb(): void {
  const db = getTestDb();
  db.exec('DROP TABLE IF EXISTS gate_verdicts');
  db.exec('DROP TABLE IF EXISTS telemetry_snapshots');
  db.exec('DROP TABLE IF EXISTS agents');
  db.exec('DROP TABLE IF EXISTS work_requests');
  db.exec(SCHEMA);
  db.exec(SEED_AGENTS);
}

// Override the db module for tests using environment variable
process.env.DB_PATH = ':memory:';

export async function buildTestApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  await app.register(wrRoutes);
  await app.register(agentsRoutes);
  await app.register(telemetryRoutes);
  await app.register(gatesRoutes);
  await app.register(cronRoutes);
  app.get('/api/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));
  await app.ready();
  return app;
}

export const LIVE_URL = process.env.TEST_SERVER_URL ?? 'http://localhost:8081';
