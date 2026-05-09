import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DB_PATH ?? './server/data/hos.db';
const db = new Database(resolve(process.cwd(), dbPath));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(resolve(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

function seedAgents() {
  const count = db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number };
  if (count.c > 0) return;

  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO agents (id, name, role, model, tools, skills, current_wr, status, iteration_count, last_activity_at, tokens_used_session)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'idle', 0, ?, 0)
  `);

  const agents = [
    { id: 'orc', name: 'HOS Orchestrator', role: 'orchestrator', model: 'claude-opus-4-7',
      tools: ['Bash','Read','Write','Edit','Glob','Grep','Agent','TodoWrite'],
      skills: ['ralph-loop-infinite','feature-dev:feature-dev','commit-commands:commit-push-pr'] },
    { id: 'frd', name: 'Front Door', role: 'front_door', model: 'claude-sonnet-4-6',
      tools: ['Read','Bash','Grep'],
      skills: ['compound-engineering:ce-plan'] },
    { id: 'sol', name: 'Solution Designer', role: 'solution_designer', model: 'claude-sonnet-4-6',
      tools: ['Read','Glob','Grep','WebSearch','WebFetch'],
      skills: ['compound-engineering:ce-ideate','compound-engineering:ce-strategy'] },
    { id: 'res', name: 'Research Agent', role: 'research', model: 'claude-sonnet-4-6',
      tools: ['WebSearch','WebFetch','Read'],
      skills: ['compound-engineering:ce-best-practices-researcher'] },
    { id: 'ver', name: 'Verifier Agent', role: 'verifier', model: 'claude-opus-4-7',
      tools: ['Read','Bash','Grep'],
      skills: ['ralph-loop:ralph-loop'] },
  ];

  for (const a of agents) {
    insert.run(a.id, a.name, a.role, a.model, JSON.stringify(a.tools), JSON.stringify(a.skills), now);
  }
}

seedAgents();

export default db;
