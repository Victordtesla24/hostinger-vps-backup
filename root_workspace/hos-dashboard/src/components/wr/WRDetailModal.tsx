import { useState } from 'react';
import { useHOSStore } from '../../store/hosStore';
import type { WorkRequest, ExecutionStep, VerifierVerdict } from '../../types';
import { DecompositionDiff } from './DecompositionDiff';

const GATE_COLORS = { ARMED: '#ef5350', SOFT_RESOLVED: '#ffb300', DISARMED: '#546e7a' };

function TraceStep({ step }: { step: ExecutionStep }) {
  const [open, setOpen] = useState(false);
  const typeColors: Record<string, string> = {
    tool_call: '#4fc3f7', reasoning: '#26c6da', output: '#66bb6a',
    human_annotation: '#ffb300', gate_check: '#ef5350',
  };
  return (
    <div className="border-l-2 border-[#1a1a3e] pl-3 pb-3 cursor-pointer" onClick={() => setOpen(!open)}>
      <div className="flex items-center gap-2">
        <span className="text-[10px]" style={{ color: typeColors[step.type] ?? '#546e7a' }}>
          [{step.type.toUpperCase()}]
        </span>
        <span className="text-[11px] text-[#c8d6e5]">{step.description}</span>
        <span className="text-[10px] text-[#546e7a] ml-auto">{step.agentId}</span>
      </div>
      {open && step.result && (
        <pre className="mt-1 text-[10px] text-[#546e7a] bg-[#080815] rounded p-2 overflow-x-auto whitespace-pre-wrap">{step.result}</pre>
      )}
      <span className="text-[9px] text-[#2a2a4e]">{new Date(step.timestamp).toLocaleTimeString()}</span>
    </div>
  );
}

function VerdictRow({ v }: { v: VerifierVerdict }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#1a1a3e]">
      <span className={`text-[11px] font-bold ${v.verdict === 'PASS' ? 'text-[#66bb6a]' : 'text-[#ef5350]'}`}>
        {v.verdict}
      </span>
      <span className="text-[10px] text-[#546e7a]">Iter {v.iteration}</span>
      <span className="text-[11px] text-[#c8d6e5] flex-1">{v.reason}</span>
      <span className={`text-[10px] ${v.hmacValid ? 'text-[#66bb6a]' : 'text-[#ef5350]'}`}>
        {v.hmacValid ? '✓ HMAC' : '✗ HMAC'}
      </span>
    </div>
  );
}

export function WRDetailModal() {
  const selectedWR = useHOSStore((s) => s.selectedWR);
  const selectWR = useHOSStore((s) => s.selectWR);
  const upsertWR = useHOSStore((s) => s.upsertWR);
  const agents = useHOSStore((s) => s.agents);
  const [tab, setTab] = useState<'overview' | 'decomp' | 'trace' | 'gate'>('overview');
  const [annotation, setAnnotation] = useState('');
  const [assignAgent, setAssignAgent] = useState('');
  const [working, setWorking] = useState(false);

  if (!selectedWR) return null;
  const wr = selectedWR;

  async function patchWR(patch: Record<string, unknown>) {
    setWorking(true);
    try {
      const res = await fetch(`/api/v1/wr/${wr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const updated = await res.json() as WorkRequest;
      upsertWR(updated);
      selectWR(updated);
    } finally {
      setWorking(false);
    }
  }

  async function handleSendToFrontDoor() {
    await patchWR({ status: 'FRONT_DOOR' });
  }

  async function handleAssign() {
    if (!assignAgent) return;
    const res = await fetch(`/api/v1/agents/${assignAgent}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrId: wr.id }),
    });
    const updated = await res.json() as WorkRequest;
    upsertWR(updated);
    selectWR(updated);
  }

  async function handleAnnotation() {
    if (!annotation.trim()) return;
    const currentAgent = wr.assignedAgent ?? 'orc';
    await fetch(`/api/v1/agents/${currentAgent}/inject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrId: wr.id, annotation }),
    });
    setAnnotation('');
    const res = await fetch(`/api/v1/wr/${wr.id}`);
    const updated = await res.json() as WorkRequest;
    upsertWR(updated);
    selectWR(updated);
  }

  async function handleExport(format: 'json' | 'md') {
    const res = await fetch(`/api/v1/wr/${wr.id}/export?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wr.id}.${format === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'decomp', label: 'Decomposition' },
    { id: 'trace', label: `Trace (${(wr.trace as unknown[]).length})` },
    { id: 'gate', label: `Gate (${(wr.verdicts as unknown[]).length})` },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/60 backdrop-blur-sm">
      <div className="ml-auto w-full max-w-2xl bg-[#0d0d20] border-l border-[#1a1a3e] flex flex-col slide-in-right overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a3e] shrink-0">
          <div>
            <p className="text-[11px] text-[#546e7a] font-mono">{wr.id}</p>
            <h2 className="text-sm text-[#c8d6e5] font-semibold mt-0.5">{wr.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded font-mono"
              style={{ color: GATE_COLORS[wr.gateState], background: `${GATE_COLORS[wr.gateState]}22` }}
            >
              {wr.gateState}
            </span>
            <button onClick={() => selectWR(null)} className="text-[#546e7a] hover:text-[#c8d6e5] text-xl ml-2">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1a1a3e] shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-[11px] transition-colors ${tab === t.id ? 'text-[#4fc3f7] border-b-2 border-[#4fc3f7]' : 'text-[#546e7a] hover:text-[#c8d6e5]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Status', value: wr.status },
                  { label: 'Priority', value: `P${wr.priority}` },
                  { label: 'Type', value: wr.type },
                  { label: 'Agent', value: wr.assignedAgent ?? 'Unassigned' },
                  { label: 'Gate Iterations', value: wr.gateIterations.toString() },
                  { label: 'Created', value: new Date(wr.createdAt).toLocaleDateString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#080815] rounded p-2">
                    <p className="text-[10px] text-[#546e7a] uppercase">{label}</p>
                    <p className="text-[12px] text-[#c8d6e5] mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-[#080815] rounded p-3">
                <p className="text-[10px] text-[#546e7a] uppercase mb-2">Description</p>
                <p className="text-[12px] text-[#c8d6e5] leading-relaxed whitespace-pre-wrap">{wr.description}</p>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {wr.status === 'DRAFT' && (
                  <button
                    onClick={handleSendToFrontDoor}
                    disabled={working}
                    className="w-full py-2 rounded border border-[#4fc3f744] text-[#4fc3f7] text-[12px] hover:bg-[#4fc3f711] transition-colors disabled:opacity-50"
                  >
                    Send to Front Door
                  </button>
                )}

                {(wr.status === 'FRONT_DOOR' || wr.status === 'ASSIGNED') && agents.length > 0 && (
                  <div className="flex gap-2">
                    <select
                      value={assignAgent}
                      onChange={(e) => setAssignAgent(e.target.value)}
                      className="flex-1 bg-[#080815] border border-[#1a1a3e] rounded px-2 py-1.5 text-[12px] text-[#c8d6e5] focus:border-[#4fc3f7] focus:outline-none"
                    >
                      <option value="">Select Agent</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} ({a.status})</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssign}
                      disabled={!assignAgent}
                      className="px-4 py-1.5 rounded border border-[#4fc3f744] text-[#4fc3f7] text-[12px] hover:bg-[#4fc3f711] disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </div>
                )}

                {/* Annotation injection */}
                <div className="flex gap-2">
                  <input
                    value={annotation}
                    onChange={(e) => setAnnotation(e.target.value)}
                    placeholder="Inject human annotation..."
                    className="flex-1 bg-[#080815] border border-[#1a1a3e] rounded px-2 py-1.5 text-[12px] text-[#c8d6e5] focus:border-[#ffb300] focus:outline-none"
                  />
                  <button
                    onClick={handleAnnotation}
                    disabled={!annotation.trim()}
                    className="px-3 py-1.5 rounded border border-[#ffb30044] text-[#ffb300] text-[12px] hover:bg-[#ffb30011] disabled:opacity-50"
                  >
                    Inject
                  </button>
                </div>

                {/* Export */}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => handleExport('md')} className="text-[11px] text-[#546e7a] hover:text-[#c8d6e5]">
                    ↓ Export Markdown
                  </button>
                  <button onClick={() => handleExport('json')} className="text-[11px] text-[#546e7a] hover:text-[#c8d6e5]">
                    ↓ Export JSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'decomp' && (
            <div className="space-y-4">
              {wr.decomposition ? (
                <>
                  <div className="bg-[#080815] rounded p-3">
                    <p className="text-[10px] text-[#546e7a] uppercase mb-1">Quality Score</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full bg-[#1a1a3e] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${wr.decomposition.qualityScore ?? 0}%`,
                            backgroundColor: wr.decomposition.qualityScore > 80 ? '#66bb6a' : '#ffb300',
                          }}
                        />
                      </div>
                      <span className="text-sm text-[#c8d6e5]">{wr.decomposition.qualityScore ?? 0}%</span>
                    </div>
                  </div>

                  <DecompositionDiff description={wr.description} decomposition={wr.decomposition} />

                  {(wr.decomposition.ambiguityFlags ?? []).length > 0 && (
                    <div className="bg-[#ffb30011] border border-[#ffb30033] rounded p-3">
                      <p className="text-[10px] text-[#ffb300] uppercase mb-2">Ambiguity Flags</p>
                      {wr.decomposition.ambiguityFlags.map((f, i) => (
                        <p key={i} className="text-[12px] text-[#ffb300]">⚠ {f}</p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[#546e7a]">No decomposition yet. Send to Front Door to generate one.</p>
              )}
            </div>
          )}

          {tab === 'trace' && (
            <div>
              {(wr.trace as ExecutionStep[]).length === 0 ? (
                <p className="text-[12px] text-[#546e7a]">No execution steps yet.</p>
              ) : (
                <div className="space-y-0">
                  {(wr.trace as ExecutionStep[]).map((step, i) => (
                    <TraceStep key={i} step={step} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'gate' && (
            <div className="space-y-3">
              <div className={`p-3 rounded border ${wr.gateState === 'ARMED' ? 'gate-armed border-[#ef535066] bg-[#ef535011]' : 'border-[#1a1a3e] bg-[#080815]'}`}>
                <p className="text-[10px] text-[#546e7a] uppercase mb-1">Gate State</p>
                <p className="text-sm font-bold" style={{ color: GATE_COLORS[wr.gateState] }}>{wr.gateState}</p>
                <p className="text-[11px] text-[#546e7a] mt-0.5">{wr.gateIterations} iterations</p>
              </div>

              {(wr.verdicts as VerifierVerdict[]).length > 0 && (
                <div>
                  <p className="text-[10px] text-[#546e7a] uppercase mb-2">Verdict History</p>
                  {(wr.verdicts as VerifierVerdict[]).map((v, i) => (
                    <VerdictRow key={i} v={v} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
