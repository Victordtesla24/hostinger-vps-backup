import { useHOSStore } from '../../store/hosStore';
import type { AgentStatus } from '../../types';

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: '#546e7a',
  running: '#4fc3f7',
  blocked: '#ffb300',
  failed: '#ef5350',
  paused: '#26c6da',
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: 'IDLE',
  running: 'RUN',
  blocked: 'BLKD',
  failed: 'FAIL',
  paused: 'PAUSE',
};

export function AgentStatusGrid() {
  const agents = useHOSStore((s) => s.agents);

  return (
    <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3 h-full">
      <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">Agents</p>
      {agents.length === 0 ? (
        <p className="text-[11px] text-[#546e7a]">Connecting...</p>
      ) : (
        <div className="space-y-2">
          {agents.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.status === 'running' ? 'status-pulse' : ''}`}
                style={{ backgroundColor: STATUS_DOT[a.status] }}
              />
              <span className="text-[11px] text-[#c8d6e5] flex-1 truncate">{a.name}</span>
              <span className="text-[10px] font-mono" style={{ color: STATUS_DOT[a.status] }}>
                {STATUS_LABEL[a.status]}
              </span>
              {a.currentWR && (
                <span className="text-[9px] text-[#546e7a] font-mono truncate max-w-20">{a.currentWR}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
