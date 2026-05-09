import { useState } from 'react';
import { useHOSStore } from '../store/hosStore';
import type { AgentPersona, AgentStatus } from '../types';

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: '#546e7a', running: '#4fc3f7', blocked: '#ffb300', failed: '#ef5350', paused: '#26c6da',
};
const ROLE_ICON: Record<string, string> = {
  orchestrator: '◈', solution_designer: '◎', research: '◆', front_door: '▶', verifier: '⬡', specialist: '○',
};

function AgentCard({ agent, onSelect, selected }: { agent: AgentPersona; onSelect: () => void; selected: boolean }) {
  return (
    <div
      onClick={onSelect}
      className={`
        cursor-pointer rounded border p-4 transition-all duration-150
        ${selected
          ? 'border-[#4fc3f744] bg-[#4fc3f708]'
          : 'border-[#1a1a3e] bg-[#0d0d20] hover:border-[#2a2a4e]'
        }
        ${agent.status === 'failed' ? 'gate-armed border-[#ef535044]' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" style={{ color: STATUS_COLOR[agent.status] }}>
            {ROLE_ICON[agent.role] ?? '○'}
          </span>
          <div>
            <p className="text-[12px] text-[#c8d6e5] font-semibold">{agent.name}</p>
            <p className="text-[10px] text-[#546e7a] uppercase">{agent.role.replace('_', ' ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${agent.status === 'running' ? 'status-pulse' : ''}`}
            style={{ backgroundColor: STATUS_COLOR[agent.status] }}
          />
          <span className="text-[10px] font-mono uppercase" style={{ color: STATUS_COLOR[agent.status] }}>
            {agent.status}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-[#546e7a]">Model</span>
          <span className="text-[#c8d6e5] font-mono">{agent.model}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-[#546e7a]">Iterations</span>
          <span className="text-[#c8d6e5]">{agent.iterationCount}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-[#546e7a]">Tokens</span>
          <span className="text-[#c8d6e5]">{agent.tokensUsedSession.toLocaleString()}</span>
        </div>
        {agent.currentWR && (
          <div className="flex justify-between text-[10px]">
            <span className="text-[#546e7a]">WR</span>
            <span className="text-[#4fc3f7] font-mono">{agent.currentWR}</span>
          </div>
        )}
      </div>

      {agent.tools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {agent.tools.slice(0, 4).map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a1a3e] text-[#546e7a]">{t}</span>
          ))}
          {agent.tools.length > 4 && (
            <span className="text-[9px] text-[#2a2a4e]">+{agent.tools.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

function AgentControlPanel({ agent }: { agent: AgentPersona }) {
  const upsertAgent = useHOSStore((s) => s.upsertAgent);
  const upsertWR = useHOSStore((s) => s.upsertWR);
  const workRequests = useHOSStore((s) => s.workRequests);
  const [wrAssign, setWrAssign] = useState('');
  const [annotation, setAnnotation] = useState('');
  const [spawnWR, setSpawnWR] = useState('');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState('');

  async function doAction(url: string, body?: object) {
    setWorking(true);
    setMsg('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json() as AgentPersona;
      upsertAgent(data);
      setMsg('Done');
    } catch {
      setMsg('Error');
    } finally {
      setWorking(false);
    }
  }

  async function handleAssign() {
    if (!wrAssign) return;
    setWorking(true);
    setMsg('');
    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wrId: wrAssign }),
      });
      const wr = await res.json();
      upsertWR(wr);
      setWrAssign('');
      setMsg('Done');
    } catch {
      setMsg('Error');
    } finally {
      setWorking(false);
    }
  }

  const assignableWRs = workRequests.filter((w) =>
    w.status === 'FRONT_DOOR' || w.status === 'ASSIGNED' || w.status === 'DRAFT'
  );

  return (
    <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-4 space-y-4">
      <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest">
        Controls — {agent.name}
      </p>

      {/* Status actions */}
      <div className="flex gap-2">
        <button
          disabled={working || agent.status !== 'running'}
          onClick={() => doAction(`/api/v1/agents/${agent.id}/pause`)}
          className="flex-1 py-1.5 rounded border border-[#ffb30033] text-[#ffb300] text-[11px] hover:bg-[#ffb30011] disabled:opacity-40"
        >
          Pause
        </button>
        <button
          disabled={working || agent.status !== 'paused'}
          onClick={() => doAction(`/api/v1/agents/${agent.id}/resume`)}
          className="flex-1 py-1.5 rounded border border-[#4fc3f733] text-[#4fc3f7] text-[11px] hover:bg-[#4fc3f711] disabled:opacity-40"
        >
          Resume
        </button>
        <button
          disabled={working || agent.status === 'idle'}
          onClick={() => doAction(`/api/v1/agents/${agent.id}/terminate`)}
          className="flex-1 py-1.5 rounded border border-[#ef535033] text-[#ef5350] text-[11px] hover:bg-[#ef535011] disabled:opacity-40"
        >
          Terminate
        </button>
      </div>

      {/* Assign WR */}
      <div>
        <p className="text-[10px] text-[#546e7a] uppercase mb-1.5">Assign Work Request</p>
        <div className="flex gap-2">
          <select
            value={wrAssign}
            onChange={(e) => setWrAssign(e.target.value)}
            className="flex-1 bg-[#080815] border border-[#1a1a3e] rounded px-2 py-1.5 text-[11px] text-[#c8d6e5] focus:border-[#4fc3f7] focus:outline-none"
          >
            <option value="">Select WR...</option>
            {assignableWRs.map((w) => (
              <option key={w.id} value={w.id}>{w.id} — {w.title.slice(0, 30)}</option>
            ))}
          </select>
          <button
            disabled={!wrAssign || working}
            onClick={handleAssign}
            className="px-3 py-1.5 rounded border border-[#4fc3f733] text-[#4fc3f7] text-[11px] hover:bg-[#4fc3f711] disabled:opacity-40"
          >
            Assign
          </button>
        </div>
      </div>

      {/* Spawn parallel stream */}
      {agent.currentWR && (
        <div>
          <p className="text-[10px] text-[#546e7a] uppercase mb-1.5">Spawn Parallel Stream</p>
          <div className="flex gap-2">
            <select
              value={spawnWR}
              onChange={(e) => setSpawnWR(e.target.value)}
              className="flex-1 bg-[#080815] border border-[#1a1a3e] rounded px-2 py-1.5 text-[11px] text-[#c8d6e5] focus:border-[#4fc3f7] focus:outline-none"
            >
              <option value="">Select WR for parallel stream...</option>
              {workRequests.filter((w) => w.status === 'IN_PROGRESS').map((w) => (
                <option key={w.id} value={w.id}>{w.id} — {w.title.slice(0, 30)}</option>
              ))}
            </select>
            <button
              disabled={!spawnWR || working}
              onClick={async () => {
                if (!spawnWR) return;
                setWorking(true);
                await fetch(`/api/v1/wr/${spawnWR}/parallel-stream`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ agentId: agent.id }),
                });
                setWorking(false);
                setMsg('Stream spawned');
              }}
              className="px-3 py-1.5 rounded border border-[#26c6da33] text-[#26c6da] text-[11px] hover:bg-[#26c6da11] disabled:opacity-40"
            >
              Spawn
            </button>
          </div>
        </div>
      )}

      {/* Inject annotation */}
      {agent.currentWR && (
        <div>
          <p className="text-[10px] text-[#546e7a] uppercase mb-1.5">Inject Annotation</p>
          <div className="flex gap-2">
            <input
              value={annotation}
              onChange={(e) => setAnnotation(e.target.value)}
              placeholder={`Context for ${agent.name}...`}
              className="flex-1 bg-[#080815] border border-[#1a1a3e] rounded px-2 py-1.5 text-[11px] text-[#c8d6e5] focus:border-[#ffb300] focus:outline-none"
            />
            <button
              disabled={!annotation.trim() || working}
              onClick={async () => {
                if (!annotation.trim() || !agent.currentWR) return;
                setWorking(true);
                await fetch(`/api/v1/agents/${agent.id}/inject`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ wrId: agent.currentWR, annotation }),
                });
                setAnnotation('');
                setWorking(false);
                setMsg('Injected');
              }}
              className="px-3 py-1.5 rounded border border-[#ffb30033] text-[#ffb300] text-[11px] hover:bg-[#ffb30011] disabled:opacity-40"
            >
              Inject
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-[11px] text-[#66bb6a]">{msg}</p>}

      {/* Execution trace */}
      {agent.currentWR && (
        <div>
          <p className="text-[10px] text-[#546e7a] uppercase mb-1">Current WR</p>
          <p className="text-[12px] text-[#4fc3f7] font-mono">{agent.currentWR}</p>
        </div>
      )}

      {/* Skills */}
      <div>
        <p className="text-[10px] text-[#546e7a] uppercase mb-1.5">Skills</p>
        <div className="flex flex-wrap gap-1">
          {agent.skills.map((s) => (
            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[#4fc3f711] border border-[#4fc3f722] text-[#4fc3f7]">
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgentsPage() {
  const agents = useHOSStore((s) => s.agents);
  const [selected, setSelected] = useState<AgentPersona | null>(null);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Agent grid */}
      <div className="w-96 shrink-0 border-r border-[#1a1a3e] overflow-y-auto p-4 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-sm font-bold text-[#4fc3f7] tracking-widest">AGENTS</h1>
          <span className="text-[11px] text-[#546e7a]">{agents.length} configured</span>
        </div>
        {agents.length === 0 ? (
          <p className="text-[11px] text-[#546e7a]">Loading agents...</p>
        ) : (
          agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              selected={selected?.id === a.id}
              onSelect={() => setSelected(a)}
            />
          ))
        )}
      </div>

      {/* Control panel */}
      <div className="flex-1 overflow-y-auto p-4">
        {selected ? (
          <AgentControlPanel agent={agents.find((a) => a.id === selected.id) ?? selected} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#546e7a] text-[12px]">Select an agent to view controls</p>
          </div>
        )}
      </div>
    </div>
  );
}
