CREATE TABLE IF NOT EXISTS work_requests (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('feature','bug','research','infra')),
  priority INTEGER NOT NULL CHECK(priority BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'DRAFT',
  assigned_agent TEXT,
  parallel_streams TEXT NOT NULL DEFAULT '[]',
  decomposition TEXT,
  gate_state TEXT NOT NULL DEFAULT 'DISARMED',
  gate_iterations INTEGER NOT NULL DEFAULT 0,
  verdicts TEXT NOT NULL DEFAULT '[]',
  trace TEXT NOT NULL DEFAULT '[]',
  annotations TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model TEXT NOT NULL,
  tools TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  current_wr TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  iteration_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT NOT NULL,
  tokens_used_session INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  vps_data TEXT NOT NULL,
  pipeline_data TEXT NOT NULL,
  quota_data TEXT NOT NULL,
  quality_data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gate_verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wr_id TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  verdict TEXT NOT NULL CHECK(verdict IN ('PASS','FAIL')),
  reason TEXT NOT NULL,
  hmac_valid INTEGER NOT NULL DEFAULT 1,
  hmac_fingerprint TEXT NOT NULL DEFAULT '',
  timestamp TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wr_status ON work_requests(status);
CREATE INDEX IF NOT EXISTS idx_wr_assigned ON work_requests(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_verdicts_wr ON gate_verdicts(wr_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry_snapshots(timestamp);
