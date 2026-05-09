import { FastifyInstance } from 'fastify';
import { collectTelemetry } from '../services/telemetry.service';
import { collectVPSMetrics } from '../lib/vpsMetrics';
import { collectQuotaMetrics } from '../lib/anthropicQuota';
import { computeQualityMetrics } from '../lib/stateFileParser';
import db from '../db/db';

export async function telemetryRoutes(app: FastifyInstance) {
  app.get('/api/v1/telemetry/vps', async (_req, reply) => {
    try {
      const vps = await collectVPSMetrics();
      return reply.send(vps);
    } catch (err) {
      app.log.error({ err }, '[telemetry] vps collection failed');
      return reply.status(503).send({ error: 'VPS metrics temporarily unavailable' });
    }
  });

  app.get('/api/v1/telemetry/pipeline', async (_req, reply) => {
    try {
      const bundle = await collectTelemetry();
      return reply.send(bundle.pipeline);
    } catch (err) {
      app.log.error({ err }, '[telemetry] pipeline collection failed');
      return reply.status(503).send({ error: 'Pipeline metrics temporarily unavailable' });
    }
  });

  app.get('/api/v1/telemetry/quota', async (_req, reply) => {
    try {
      const quota = await collectQuotaMetrics();
      return reply.send(quota);
    } catch (err) {
      app.log.error({ err }, '[telemetry] quota collection failed');
      return reply.status(503).send({ error: 'Quota metrics temporarily unavailable' });
    }
  });

  app.get('/api/v1/telemetry/quality', async (_req, reply) => {
    try {
      const quality = computeQualityMetrics(db);
      return reply.send(quality);
    } catch (err) {
      app.log.error({ err }, '[telemetry] quality metrics failed');
      return reply.status(503).send({ error: 'Quality metrics temporarily unavailable' });
    }
  });

  app.get('/api/v1/telemetry/snapshot', async (_req, reply) => {
    try {
      const bundle = await collectTelemetry();
      return reply.send(bundle);
    } catch (err) {
      app.log.error({ err }, '[telemetry] snapshot collection failed');
      return reply.status(503).send({ error: 'Telemetry snapshot temporarily unavailable' });
    }
  });

  app.get('/api/v1/telemetry/history', async (req, reply) => {
    const { range } = req.query as { range?: string };
    const hours = range === '7d' ? 168 : range === '24h' ? 24 : range === '6h' ? 6 : 1;
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
    const rows = db.prepare(
      'SELECT timestamp, vps_data, pipeline_data, quota_data, quality_data FROM telemetry_snapshots WHERE timestamp >= ? ORDER BY timestamp ASC'
    ).all(since) as { timestamp: string; vps_data: string; pipeline_data: string; quota_data: string; quality_data: string }[];

    const snapshots = rows.map((r) => ({
      timestamp: r.timestamp,
      vps: JSON.parse(r.vps_data),
      pipeline: JSON.parse(r.pipeline_data),
      quota: JSON.parse(r.quota_data),
      quality: JSON.parse(r.quality_data),
    }));
    return reply.send(snapshots);
  });
}
