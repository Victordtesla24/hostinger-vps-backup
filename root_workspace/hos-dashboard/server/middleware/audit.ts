import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { FastifyInstance } from 'fastify';

const LOG_PATH = '/root/.hermes/logs/hos-audit.log';

mkdirSync(dirname(LOG_PATH), { recursive: true });

export function registerAuditMiddleware(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply) => {
    const method = request.method;
    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') return;

    const entry = {
      timestamp: new Date().toISOString(),
      ip: request.ip,
      method,
      action: request.url,
      operator: (request.headers['x-operator-id'] as string | undefined) ?? 'anonymous',
      status: reply.statusCode,
    };

    appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
  });
}
