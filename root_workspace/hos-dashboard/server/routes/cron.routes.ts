/**
 * cron.routes.ts
 *
 * REST endpoints for cron job management:
 *   GET  /api/v1/cron/jobs          — list all jobs (hermes + OS)
 *   POST /api/v1/cron/jobs          — create a new hermes cron job
 */

import { FastifyInstance } from 'fastify';
import { listAllCronJobs, createHermesCronJob, CreateCronJobRequest } from '../services/cron.service';
import { broadcast } from '../websocket/hub';

export async function cronRoutes(app: FastifyInstance) {
  /** List all active cron jobs (Hermes native + OS crontab) */
  app.get('/api/v1/cron/jobs', async (_req, reply) => {
    try {
      const jobs = listAllCronJobs();
      return reply.send(jobs);
    } catch (err) {
      app.log.error({ err }, '[cron] listAllCronJobs failed');
      return reply.status(500).send({ error: 'Failed to list cron jobs' });
    }
  });

  /** Create a new Hermes cron job */
  app.post('/api/v1/cron/jobs', async (req, reply) => {
    const body = req.body as Partial<CreateCronJobRequest>;

    if (!body.name || typeof body.name !== 'string') {
      return reply.status(400).send({ error: 'name is required' });
    }
    if (!body.schedule || typeof body.schedule !== 'string') {
      return reply.status(400).send({ error: 'schedule is required' });
    }
    if (!body.prompt && !body.script) {
      return reply.status(400).send({ error: 'Either prompt or script is required' });
    }

    try {
      const job = createHermesCronJob({
        name: body.name,
        schedule: body.schedule,
        prompt: body.prompt,
        script: body.script,
        deliver: body.deliver,
      });

      broadcast('CRON_JOB_CREATED', job);
      return reply.status(201).send(job);
    } catch (err) {
      app.log.error({ err }, '[cron] createHermesCronJob failed');
      const message = err instanceof Error ? err.message : 'Failed to create cron job';
      return reply.status(500).send({ error: message });
    }
  });
}
