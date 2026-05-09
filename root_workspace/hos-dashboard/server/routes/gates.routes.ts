import { FastifyInstance } from 'fastify';
import {
  getGateStateForWR, getAllActiveGates, disarmGate,
  getGateLog, getViolations, getGlobalGateState,
} from '../services/gate.service';
import { getWR } from '../services/wr.service';
import { broadcast } from '../websocket/hub';

export async function gatesRoutes(app: FastifyInstance) {
  app.get('/api/v1/gates/active', async (_req, reply) => {
    return reply.send(getAllActiveGates());
  });

  app.get('/api/v1/gates/global', async (_req, reply) => {
    return reply.send(getGlobalGateState());
  });

  app.get('/api/v1/gates/log', async (req, reply) => {
    const { n } = req.query as { n?: string };
    return reply.send(getGateLog(n ? parseInt(n) : 100));
  });

  app.get('/api/v1/gates/violations', async (req, reply) => {
    const { n } = req.query as { n?: string };
    return reply.send(getViolations(n ? parseInt(n) : 50));
  });

  app.get('/api/v1/gates/:wrId', async (req, reply) => {
    const { wrId } = req.params as { wrId: string };
    const state = getGateStateForWR(wrId);
    if (!state) return reply.status(404).send({ error: 'WR not found' });
    return reply.send(state);
  });

  app.get('/api/v1/gates/:wrId/verdicts', async (req, reply) => {
    const { wrId } = req.params as { wrId: string };
    const state = getGateStateForWR(wrId);
    if (!state) return reply.status(404).send({ error: 'WR not found' });
    return reply.send(state.verdicts);
  });

  app.post('/api/v1/gates/:wrId/disarm', async (req, reply) => {
    const { wrId } = req.params as { wrId: string };
    const { reason } = req.body as { reason: string };
    if (!reason) return reply.status(400).send({ error: 'reason is required' });
    if (!getWR(wrId)) return reply.status(404).send({ error: 'WR not found' });
    const result = disarmGate(wrId, reason);
    if (!result.success) return reply.status(400).send({ error: result.error });
    broadcast('GATE_DISARMED', { wrId, reason });
    return reply.send(getWR(wrId));
  });
}
