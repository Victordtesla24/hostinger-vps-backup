import type { FastifyInstance } from 'fastify';
import { validateSharedSecret, createSession, SESSION_TTL_MS } from '../middleware/auth';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/auth/login', async (req, reply) => {
    const { token } = req.body as { token?: string };
    if (!token) return reply.code(400).send({ error: 'token is required' });
    if (!validateSharedSecret(token)) return reply.code(401).send({ error: 'Invalid token' });
    const sessionToken = createSession();
    return reply.send({ token: sessionToken, expiresIn: SESSION_TTL_MS / 1000 });
  });
}
