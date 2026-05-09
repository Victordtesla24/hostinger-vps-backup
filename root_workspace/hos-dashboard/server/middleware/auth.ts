import { randomBytes } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// token → expiry timestamp (ms since epoch)
const sessions = new Map<string, number>();

function getSharedSecret(): string {
  return process.env.DASHBOARD_AUTH_TOKEN ?? 'hos-dashboard-2026';
}

export function validateSharedSecret(secret: string): boolean {
  return secret === getSharedSecret();
}

export function createSession(): string {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function validateSession(token: string): boolean {
  const expiry = sessions.get(token);
  if (expiry === undefined) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

const PUBLIC_PATHS = new Set(['/api/health', '/api/v1/auth/login']);

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (PUBLIC_PATHS.has(request.url.split('?')[0])) return;
  // Auth enforcement only in production — dev/test servers are trusted-network only
  if (process.env.NODE_ENV !== 'production') return;
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  const token = auth.slice(7);
  if (!validateSession(token)) {
    reply.code(401).send({ error: 'Session expired or invalid' });
  }
}
