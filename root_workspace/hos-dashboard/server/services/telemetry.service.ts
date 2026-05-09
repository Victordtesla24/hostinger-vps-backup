import { collectVPSMetrics, type VPSSnapshot } from '../lib/vpsMetrics';
import { collectQuotaMetrics, type QuotaSnapshot } from '../lib/anthropicQuota';
import { computeQualityMetrics } from '../lib/stateFileParser';
import db from '../db/db';

export interface PipelineSnapshot {
  wrCompletedPerHour: number;
  avgCycleTimeMinutes: number;
  p50CycleTimeMinutes: number;
  p95CycleTimeMinutes: number;
  activeWRs: number;
  queuedWRs: number;
  stalledWRs: number;
  stageBreakdown: Record<string, number>;
}

export interface TelemetryBundle {
  timestamp: string;
  vps: VPSSnapshot;
  pipeline: PipelineSnapshot;
  quota: QuotaSnapshot;
  quality: ReturnType<typeof computeQualityMetrics>;
}

function computePipelineMetrics(): PipelineSnapshot {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600_000).toISOString();

  const completedLastHour = (db.prepare(
    "SELECT COUNT(*) as c FROM work_requests WHERE status='PASSED' AND completed_at >= ?"
  ).get(oneHourAgo) as { c: number }).c;

  const rows = db.prepare(
    "SELECT created_at, completed_at FROM work_requests WHERE status='PASSED' AND completed_at IS NOT NULL"
  ).all() as { created_at: string; completed_at: string }[];

  const cycleTimes = rows.map((r) => {
    const start = new Date(r.created_at).getTime();
    const end = new Date(r.completed_at).getTime();
    return (end - start) / 60_000;
  }).filter((t) => t > 0).sort((a, b) => a - b);

  const avg = cycleTimes.length > 0
    ? cycleTimes.reduce((s, t) => s + t, 0) / cycleTimes.length
    : 0;

  const p50 = cycleTimes.length > 0
    ? cycleTimes[Math.floor(cycleTimes.length * 0.5)]
    : 0;

  const p95 = cycleTimes.length > 0
    ? cycleTimes[Math.floor(cycleTimes.length * 0.95)]
    : 0;

  const stageRows = db.prepare(
    "SELECT status, COUNT(*) as c FROM work_requests GROUP BY status"
  ).all() as { status: string; c: number }[];

  const stageBreakdown: Record<string, number> = {};
  for (const r of stageRows) stageBreakdown[r.status] = r.c;

  const activeWRs = (stageBreakdown['IN_PROGRESS'] ?? 0) + (stageBreakdown['VERIFICATION'] ?? 0);
  const queuedWRs = (stageBreakdown['DRAFT'] ?? 0) + (stageBreakdown['FRONT_DOOR'] ?? 0) + (stageBreakdown['ASSIGNED'] ?? 0);
  const stalledWRs = (db.prepare(
    "SELECT COUNT(*) as c FROM work_requests WHERE status='IN_PROGRESS' AND updated_at < ?"
  ).get(new Date(now.getTime() - 3600_000 * 2).toISOString()) as { c: number }).c;

  return {
    wrCompletedPerHour: completedLastHour,
    avgCycleTimeMinutes: Math.round(avg),
    p50CycleTimeMinutes: Math.round(p50),
    p95CycleTimeMinutes: Math.round(p95),
    activeWRs,
    queuedWRs,
    stalledWRs,
    stageBreakdown,
  };
}

export async function collectTelemetry(): Promise<TelemetryBundle> {
  const [vps, quota] = await Promise.all([collectVPSMetrics(), collectQuotaMetrics()]);
  const pipeline = computePipelineMetrics();
  const quality = computeQualityMetrics(db);

  const bundle: TelemetryBundle = {
    timestamp: new Date().toISOString(),
    vps,
    pipeline,
    quota,
    quality,
  };

  db.prepare(`
    INSERT INTO telemetry_snapshots (timestamp, vps_data, pipeline_data, quota_data, quality_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    bundle.timestamp,
    JSON.stringify(vps),
    JSON.stringify(pipeline),
    JSON.stringify(quota),
    JSON.stringify(quality),
  );

  // Prune snapshots older than 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
  db.prepare('DELETE FROM telemetry_snapshots WHERE timestamp < ?').run(cutoff);

  return bundle;
}
