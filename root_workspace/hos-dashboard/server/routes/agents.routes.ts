import { FastifyInstance } from 'fastify';
import {
  listAgents, getAgent, assignWR, pauseAgent, resumeAgent,
  terminateAgent, injectAnnotation,
} from '../services/agent.service';
import { getWR } from '../services/wr.service';
import { broadcast } from '../websocket/hub';

export async function agentsRoutes(app: FastifyInstance) {
  app.get('/api/v1/agents', async (_req, reply) => {
    return reply.send(listAgents());
  });

  app.get('/api/v1/agents/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getAgent(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    return reply.send(agent);
  });

  app.post('/api/v1/agents/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { wrId } = req.body as { wrId: string };
    if (!wrId) return reply.status(400).send({ error: 'wrId required' });
    const agent = assignWR(id, wrId);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    broadcast('AGENT_ASSIGNED', { agentId: id, wrId });
    const wr = getWR(wrId);
    return reply.send(wr ?? agent);
  });

  app.post('/api/v1/agents/:id/pause', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = pauseAgent(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    broadcast('AGENT_PAUSED', { agentId: id });
    return reply.send(agent);
  });

  app.post('/api/v1/agents/:id/resume', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = resumeAgent(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    broadcast('AGENT_RESUMED', { agentId: id });
    return reply.send(agent);
  });

  app.post('/api/v1/agents/:id/terminate', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = terminateAgent(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    broadcast('AGENT_TERMINATED', { agentId: id });
    return reply.send(agent);
  });

  app.post('/api/v1/agents/:id/inject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { wrId, annotation } = req.body as { wrId: string; annotation: string };
    if (!wrId || !annotation) return reply.status(400).send({ error: 'wrId and annotation required' });
    const result = injectAnnotation(id, wrId, annotation);
    if (!result) return reply.status(404).send({ error: 'WR not found' });
    broadcast('ANNOTATION_INJECTED', result);
    return reply.status(201).send(result);
  });
}
