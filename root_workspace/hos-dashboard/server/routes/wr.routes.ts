import { FastifyInstance } from 'fastify';
import {
  listWRs, getWR, createWR, updateWR, archiveWR,
  addTraceStep, addVerdict, spawnParallelStream, exportWRAsMarkdown,
} from '../services/wr.service';
import { broadcast } from '../websocket/hub';

export async function wrRoutes(app: FastifyInstance) {
  app.get('/api/v1/wr', async (req, reply) => {
    const { status, agent, priority, type } = req.query as Record<string, string>;
    const wrs = listWRs({
      status,
      agent,
      priority: priority ? parseInt(priority) : undefined,
      type,
    });
    return reply.send(wrs);
  });

  app.post('/api/v1/wr', async (req, reply) => {
    const body = req.body as { title: string; description: string; type: string; priority: number };
    if (!body.title || !body.description || !body.type || body.priority === undefined) {
      return reply.status(400).send({ error: 'title, description, type, and priority are required' });
    }
    const VALID_TYPES = ['feature', 'bug', 'research', 'infra'] as const;
    if (!VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) {
      return reply.status(400).send({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    const priority = Number(body.priority);
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      return reply.status(400).send({ error: 'priority must be an integer between 1 and 5' });
    }
    const wr = createWR({
      title: body.title,
      description: body.description,
      type: body.type as 'feature' | 'bug' | 'research' | 'infra',
      priority: priority as 1 | 2 | 3 | 4 | 5,
    });
    broadcast('WR_CREATED', wr);
    return reply.status(201).send(wr);
  });

  app.get('/api/v1/wr/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wr = getWR(id);
    if (!wr) return reply.status(404).send({ error: 'Not found' });
    return reply.send(wr);
  });

  app.patch('/api/v1/wr/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    if (body.status !== undefined) {
      const existing = getWR(id);
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      const TRANSITIONS: Record<string, string[]> = {
        DRAFT:          ['FRONT_DOOR', 'FAILED'],
        FRONT_DOOR:     ['ASSIGNED', 'DRAFT', 'FAILED'],
        ASSIGNED:       ['IN_PROGRESS', 'FRONT_DOOR', 'FAILED'],
        IN_PROGRESS:    ['ARMED', 'SOFT_RESOLVED', 'PASSED', 'ASSIGNED', 'FAILED'],
        ARMED:          ['SOFT_RESOLVED', 'IN_PROGRESS', 'FAILED'],
        SOFT_RESOLVED:  ['PASSED', 'ARMED', 'FAILED'],
        PASSED:         [],
        FAILED:         [],
      };
      const allowed = TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(body.status as string)) {
        return reply.status(409).send({
          error: `Invalid transition: ${existing.status} → ${body.status}. Allowed: ${allowed.join(', ') || 'none'}`,
        });
      }
    }

    const wr = updateWR(id, {
      title: body.title as string,
      description: body.description as string,
      status: body.status as string,
      assignedAgent: body.assignedAgent as string | null,
      gateState: body.gateState as string,
      annotations: body.annotations as string[],
      decomposition: body.decomposition as object | null,
    });
    if (!wr) return reply.status(404).send({ error: 'Not found' });
    broadcast('WR_UPDATED', wr);
    return reply.send(wr);
  });

  app.delete('/api/v1/wr/:id/archive', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!getWR(id)) return reply.status(404).send({ error: 'Not found' });
    const result = archiveWR(id);
    broadcast('WR_ARCHIVED', { id });
    return reply.send(result);
  });

  app.get('/api/v1/wr/:id/trace', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wr = getWR(id);
    if (!wr) return reply.status(404).send({ error: 'Not found' });
    return reply.send(wr.trace);
  });

  app.post('/api/v1/wr/:id/trace', async (req, reply) => {
    const { id } = req.params as { id: string };
    const step = req.body as object;
    const wr = addTraceStep(id, step);
    if (!wr) return reply.status(404).send({ error: 'Not found' });
    broadcast('WR_TRACE_STEP', { wrId: id, step });
    return reply.status(201).send(wr.trace);
  });

  app.get('/api/v1/wr/:id/decomposition', async (req, reply) => {
    const { id } = req.params as { id: string };
    const wr = getWR(id);
    if (!wr) return reply.status(404).send({ error: 'Not found' });
    return reply.send(wr.decomposition ?? {});
  });

  app.post('/api/v1/wr/:id/decomposition', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = getWR(id);
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (!['DRAFT', 'FRONT_DOOR'].includes(existing.status)) {
      return reply.status(409).send({ error: `Cannot decompose WR in status ${existing.status} — must be DRAFT or FRONT_DOOR` });
    }
    const decomp = req.body as object;
    const wr = updateWR(id, { decomposition: decomp, status: 'ASSIGNED' });
    broadcast('WR_DECOMPOSED', { wrId: id, decomposition: decomp });
    return reply.status(201).send(wr);
  });

  app.post('/api/v1/wr/:id/verdict', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { verdict: string; reason: string; hmacValid: boolean; hmacFingerprint: string };
    if (!body.verdict || !body.reason || body.hmacValid === undefined || body.hmacFingerprint === undefined) {
      return reply.status(400).send({ error: 'verdict, reason, hmacValid, and hmacFingerprint are required' });
    }
    if (!['PASS', 'FAIL'].includes(body.verdict)) {
      return reply.status(400).send({ error: 'verdict must be PASS or FAIL' });
    }
    const wr = addVerdict(id, body);
    if (!wr) return reply.status(404).send({ error: 'Not found' });
    const event = body.verdict === 'PASS' ? 'GATE_PASSED' : 'GATE_FAIL';
    broadcast(event, { wrId: id, verdict: body });
    return reply.status(201).send(wr);
  });

  app.post('/api/v1/wr/:id/parallel-stream', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { agentId } = req.body as { agentId: string };
    if (!agentId || typeof agentId !== 'string' || !agentId.trim()) {
      return reply.status(400).send({ error: 'agentId is required and must be a non-empty string' });
    }
    const wr = spawnParallelStream(id, agentId);
    if (!wr) return reply.status(404).send({ error: 'Not found' });
    broadcast('PARALLEL_STREAM_SPAWNED', { wrId: id, agentId });
    return reply.send(wr);
  });

  app.get('/api/v1/wr/:id/export', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { format } = req.query as { format?: string };
    const VALID_FORMATS = ['json', 'md', undefined];
    if (!VALID_FORMATS.includes(format)) {
      return reply.status(400).send({ error: `Unknown export format "${format}". Use json or md (default).` });
    }
    if (format === 'json') {
      const wr = getWR(id);
      if (!wr) return reply.status(404).send({ error: 'Not found' });
      reply.header('Content-Disposition', `attachment; filename="${id}.json"`);
      return reply.send(wr);
    }
    const md = exportWRAsMarkdown(id);
    if (!md) return reply.status(404).send({ error: 'Not found' });
    reply.header('Content-Type', 'text/markdown');
    reply.header('Content-Disposition', `attachment; filename="${id}.md"`);
    return reply.send(md);
  });
}
