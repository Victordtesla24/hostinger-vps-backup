/**
 * cron.service.ts
 *
 * Aggregates cron job information from two sources:
 *   1. Native Hermes cron jobs (`hermes cron list`)
 *   2. OS-level crontab entries (parsed from `crontab -l`)
 *
 * The two sets are merged and tagged with a `source` field so the UI
 * can distinguish them and surface a migration suggestion for OS-level jobs.
 */

import { execSync } from 'child_process';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CronJob {
  id: string;
  name: string;
  schedule: string;          // cron expression or human label
  command: string;           // script path or hermes prompt excerpt
  source: 'hermes' | 'os';
  enabled: boolean;
  nextRunAt: string | null;  // ISO timestamp or null if un-calculable
  lastRunAt: string | null;
  description: string;
  logFile?: string;          // for OS jobs that redirect to a log
}

// ── Source 1: Hermes native cron ─────────────────────────────────────────────

/**
 * Parse `hermes cron list` text output.
 *
 * Format per job block:
 *   <id> [status]
 *     Name:      <name>
 *     Schedule:  <schedule>
 *     Repeat:    <count>
 *     Next run:  <iso>
 *     Deliver:   <delivery>
 */
function listHermesJobs(): CronJob[] {
  try {
    const raw = execSync('hermes cron list 2>/dev/null', {
      timeout: 8000,
      encoding: 'utf8',
    });

    const jobs: CronJob[] = [];
    let currentId: string | null = null;
    let currentStatus = 'active';
    let currentProps: Record<string, string> = {};

    const flushJob = () => {
      if (!currentId) return;
      jobs.push({
        id: `hermes-${currentId}`,
        name: currentProps['name'] ?? currentId,
        schedule: currentProps['schedule'] ?? '',
        command: currentProps['script'] ?? '(agent prompt)',
        source: 'hermes',
        enabled: currentStatus === 'active',
        nextRunAt: currentProps['next run'] ?? null,
        lastRunAt: currentProps['last run'] ?? null,
        description: `Hermes cron: ${currentProps['schedule'] ?? ''}`,
      });
    };

    for (const line of raw.split('\n')) {
      // Job header line: "  <hex-id> [active|paused|...]"
      const headerMatch = line.match(/^\s{2}([a-f0-9]{8,})\s+\[(\w+)\]/);
      if (headerMatch) {
        flushJob();
        currentId = headerMatch[1];
        currentStatus = headerMatch[2];
        currentProps = {};
        continue;
      }

      if (currentId) {
        // Property lines: "    Key:  value" or "    Key Name:  value"
        const propMatch = line.match(/^\s{4}([\w][\w\s]*):\s+(.+)$/);
        if (propMatch) {
          const key = propMatch[1].trim().toLowerCase();
          currentProps[key] = propMatch[2].trim();
        }
      }
    }
    flushJob();

    return jobs;
  } catch {
    return [];
  }
}

// ── Source 2: OS-level crontab ────────────────────────────────────────────────

/**
 * Parse a crontab line. Handles:
 *   - standard 5-field: MIN HOUR DOM MON DOW CMD
 *   - @reboot / @daily / @hourly / @weekly / @monthly / @yearly
 *   - inline comments (# Description on the line above)
 */
function parseCrontabLine(line: string, comment: string): CronJob | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  // @reboot-style shortcuts
  const shortcutMatch = trimmed.match(/^(@\w+)\s+(.+)$/);
  if (shortcutMatch) {
    const [, schedule, cmd] = shortcutMatch;
    const id = `os-${Buffer.from(trimmed).toString('base64').slice(0, 12)}`;
    const logMatch = cmd.match(/>>?\s*(\S+\.log\S*)/);
    return {
      id,
      name: comment || cmd.replace(/\s*>>?\s*\S+/, '').trim().split('/').pop()?.split(' ')[0] || cmd.slice(0, 40),
      schedule,
      command: cmd.trim(),
      source: 'os',
      enabled: true,
      nextRunAt: null,
      lastRunAt: null,
      description: comment || `OS crontab: ${schedule} ${cmd.slice(0, 60)}`,
      logFile: logMatch?.[1],
    };
  }

  // Standard 5-field cron
  const fieldMatch = trimmed.match(/^(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/);
  if (!fieldMatch) return null;

  const [, expr, cmd] = fieldMatch;
  const id = `os-${Buffer.from(trimmed).toString('base64').slice(0, 12)}`;
  const logMatch = cmd.match(/>>?\s*(\S+\.log\S*)/);

  return {
    id,
    name: comment || cmd.replace(/\s*>>?\s*\S+/, '').trim().split('/').pop()?.split(' ')[0] || cmd.slice(0, 40),
    schedule: expr,
    command: cmd.trim(),
    source: 'os',
    enabled: true,
    nextRunAt: null,
    lastRunAt: null,
    description: comment || `OS crontab: ${expr} ${cmd.slice(0, 60)}`,
    logFile: logMatch?.[1],
  };
}

function listOsJobs(): CronJob[] {
  try {
    const raw = execSync('crontab -l 2>/dev/null', {
      timeout: 5000,
      encoding: 'utf8',
    }).trim();

    if (!raw) return [];

    const jobs: CronJob[] = [];
    const lines = raw.split('\n');
    let pendingComment = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Capture comment lines as description for the next entry
      if (trimmed.startsWith('#')) {
        const commentText = trimmed.replace(/^#+\s*/, '');
        if (commentText && !commentText.toLowerCase().startsWith('cron')) {
          pendingComment = commentText;
        }
        continue;
      }

      if (!trimmed) {
        pendingComment = '';
        continue;
      }

      const job = parseCrontabLine(trimmed, pendingComment);
      if (job) jobs.push(job);
      pendingComment = '';
    }

    return jobs;
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function listAllCronJobs(): CronJob[] {
  const hermes = listHermesJobs();
  const os = listOsJobs();
  return [...hermes, ...os];
}

/**
 * Create a new Hermes cron job via `hermes cron create`.
 * Command format: hermes cron create SCHEDULE [PROMPT] --name NAME [--script PATH]
 */
export interface CreateCronJobRequest {
  name: string;
  schedule: string;
  prompt?: string;
  script?: string;
  deliver?: string;
}

export function createHermesCronJob(req: CreateCronJobRequest): CronJob {
  if (!req.prompt && !req.script) {
    throw new Error('Either prompt or script is required');
  }
  if (!req.schedule) throw new Error('schedule is required');

  // Shell-escape single values by wrapping in single quotes with embedded ' escaped
  const esc = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

  let cmd = `hermes cron create ${esc(req.schedule)}`;

  if (req.prompt) {
    cmd += ` ${esc(req.prompt)}`;
  }

  cmd += ` --name ${esc(req.name)}`;

  if (req.script) {
    cmd += ` --script ${esc(req.script)}`;
    if (!req.prompt) cmd += ' --no-agent';
  }

  if (req.deliver) {
    cmd += ` --deliver ${esc(req.deliver)}`;
  }

  const output = execSync(cmd, { timeout: 15000, encoding: 'utf8' });

  // `hermes cron create` prints: "Created job: <id>"
  const idMatch = output.match(/job:\s+([a-zA-Z0-9_-]+)/i);
  const newId = idMatch?.[1] ?? `job-${Date.now()}`;

  // Extract next run from output if present
  const nextRunMatch = output.match(/Next run:\s+(\S+)/i);

  return {
    id: `hermes-${newId}`,
    name: req.name,
    schedule: req.schedule,
    command: req.prompt
      ? req.prompt.slice(0, 120) + (req.prompt.length > 120 ? '…' : '')
      : (req.script ?? ''),
    source: 'hermes',
    enabled: true,
    nextRunAt: nextRunMatch?.[1] ?? null,
    lastRunAt: null,
    description: req.prompt
      ? `Agent prompt: ${req.prompt.slice(0, 80)}`
      : `Script: ${req.script}`,
  };
}
