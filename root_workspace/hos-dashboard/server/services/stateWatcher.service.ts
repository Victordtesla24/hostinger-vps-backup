import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';

export const stateEvents = new EventEmitter();

let watcher: FSWatcher | null = null;

const watchPaths = [
  process.env.HOS_GATE_LOCAL ?? '/root/.opencode/state/ralph-loop-infinite.local',
  process.env.HOS_GATE_LOG ?? '/root/.opencode/state/ralph-gate.log',
  process.env.HOS_VIOLATIONS ?? '/root/.opencode/state/violations.jsonl',
].filter(Boolean);

export function startStateWatcher() {
  if (watcher) return;
  watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  });

  watcher.on('change', (path) => {
    if (path.includes('ralph-gate.log')) {
      stateEvents.emit('gate_log_changed');
    } else if (path.includes('ralph-loop-infinite.local')) {
      stateEvents.emit('gate_state_changed');
    } else if (path.includes('violations.jsonl')) {
      stateEvents.emit('violation_recorded');
    }
  });

  watcher.on('error', (err) => {
    console.error('[stateWatcher] error:', err);
  });

  console.log('[stateWatcher] watching', watchPaths);
}

export function stopStateWatcher() {
  watcher?.close();
  watcher = null;
}
