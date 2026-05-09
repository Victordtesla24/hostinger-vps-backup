import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useHOSStore } from '../store/hosStore';
import { ManualDisarmModal } from '../components/gates/ManualDisarmModal';

const GATE_COLORS = { ARMED: '#ef5350', SOFT_RESOLVED: '#ffb300', DISARMED: '#546e7a' } as const;

interface LogEntry { timestamp: string; type: string; message: string }

export function QualityGatesPage() {
  const workRequests = useHOSStore((s) => s.workRequests);
  const qualityMetrics = useHOSStore((s) => s.qualityMetrics);
  const globalGate = useHOSStore((s) => s.globalGateState);
  const [logLines, setLogLines] = useState<LogEntry[]>([]);
  const [disarmTarget, setDisarmTarget] = useState<string | null>(null);
  const [violations, setViolations] = useState<{ ts: string; type: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/gates/log?n=50').then((r) => r.json()),
      fetch('/api/v1/gates/violations?n=20').then((r) => r.json()),
    ]).then(([log, viols]) => {
      setLogLines(log as LogEntry[]);
      setViolations(viols as { ts: string; type: string }[]);
    }).catch(() => {});
  }, []);

  function onDisarmClose() {
    setDisarmTarget(null);
  }

  const armedWRs = workRequests.filter((w) => w.gateState === 'ARMED');
  const softWRs = workRequests.filter((w) => w.gateState === 'SOFT_RESOLVED');

  const failHistData = qualityMetrics
    ? Object.entries(qualityMetrics.failReasonsHistogram)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([reason, count]) => ({ reason: reason.slice(0, 20), count }))
    : [];

  const LOG_TYPE_COLORS: Record<string, string> = {
    block: '#ef5350', pass: '#66bb6a', fail: '#ef5350',
    stop: '#ffb300', session: '#4fc3f7', info: '#546e7a',
  };

  return (
    <div className="flex flex-col h-full overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold text-[#4fc3f7] tracking-widest">QUALITY GATES — RALPH-LOOP-INFINITE</h1>
        {globalGate && (
          <div className={`flex items-center gap-2 px-3 py-1 rounded border text-[11px] ${globalGate.active ? 'border-[#ef535044] text-[#ef5350] bg-[#ef535011]' : 'border-[#1a1a3e] text-[#546e7a]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${globalGate.active ? 'bg-[#ef5350] status-pulse' : 'bg-[#546e7a]'}`} />
            Global gate {globalGate.active ? 'ARMED' : 'INACTIVE'} · {globalGate.verifier_attempts} verifier calls
          </div>
        )}
      </div>

      {/* Active Gates Table */}
      <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1a1a3e] flex items-center justify-between">
          <p className="text-[11px] text-[#4fc3f7] uppercase tracking-widest">Active Gates</p>
          <span className="text-[11px] text-[#546e7a]">{armedWRs.length} armed · {softWRs.length} soft-resolved</span>
        </div>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[#1a1a3e]">
              {['WR ID', 'Title', 'State', 'Iters', 'Last Verdict', 'HMAC', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-[10px] text-[#546e7a] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...armedWRs, ...softWRs].length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-[#546e7a] text-center">No active gates</td>
              </tr>
            ) : (
              [...armedWRs, ...softWRs].map((wr) => {
                const lastVerdict = (wr.verdicts as { verdict: string; reason: string; hmacValid: boolean; iteration: number }[])[wr.verdicts.length - 1];
                return (
                  <tr key={wr.id} className="border-b border-[#1a1a3e] hover:bg-[#1a1a2e]">
                    <td className="px-4 py-2 font-mono text-[10px] text-[#546e7a]">{wr.id}</td>
                    <td className="px-4 py-2 text-[#c8d6e5] max-w-40 truncate">{wr.title}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${wr.gateState === 'ARMED' ? 'gate-armed' : ''}`}
                        style={{ color: GATE_COLORS[wr.gateState], background: `${GATE_COLORS[wr.gateState]}22` }}
                      >
                        {wr.gateState}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[#c8d6e5]">{wr.gateIterations}</td>
                    <td className="px-4 py-2 max-w-40">
                      {lastVerdict ? (
                        <span className={lastVerdict.verdict === 'PASS' ? 'text-[#66bb6a]' : 'text-[#ef5350]'}>
                          {lastVerdict.verdict}: {lastVerdict.reason.slice(0, 30)}{lastVerdict.reason.length > 30 ? '…' : ''}
                        </span>
                      ) : <span className="text-[#546e7a]">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {lastVerdict ? (
                        <span className={lastVerdict.hmacValid ? 'text-[#66bb6a]' : 'text-[#ef5350]'}>
                          {lastVerdict.hmacValid ? '✓ VALID' : '✗ INVALID'}
                        </span>
                      ) : <span className="text-[#546e7a]">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => setDisarmTarget(wr.id)}
                        className="px-2 py-0.5 rounded border border-[#ef535033] text-[#ef5350] text-[10px] hover:bg-[#ef535011]"
                      >
                        Disarm
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Metrics + Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pass Rate */}
        {qualityMetrics && (
          <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-4 space-y-3">
            <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest">Verdict Summary</p>
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold font-mono" style={{
                color: qualityMetrics.gatePassRatePercent > 80 ? '#66bb6a' : qualityMetrics.gatePassRatePercent > 60 ? '#ffb300' : '#ef5350'
              }}>
                {qualityMetrics.gatePassRatePercent}%
              </div>
              <div>
                <p className="text-[10px] text-[#546e7a]">pass rate</p>
                <p className="text-[10px] text-[#546e7a]">{qualityMetrics.totalVerifications} total</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#66bb6a]">PASS</span>
                <span className="text-[#66bb6a]">{Math.round(qualityMetrics.totalVerifications * qualityMetrics.gatePassRatePercent / 100)}</span>
              </div>
              <div className="h-1.5 bg-[#1a1a3e] rounded-full overflow-hidden">
                <div className="h-full bg-[#66bb6a] rounded-full" style={{ width: `${qualityMetrics.gatePassRatePercent}%` }} />
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-[#ef5350]">FAIL</span>
                <span className="text-[#ef5350]">{qualityMetrics.totalVerifications - Math.round(qualityMetrics.totalVerifications * qualityMetrics.gatePassRatePercent / 100)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-[#0a0a1a] rounded p-2 text-center">
                <p className="text-[9px] text-[#546e7a] uppercase">Avg Iters</p>
                <p className="text-[16px] font-mono font-bold text-[#4fc3f7]">{qualityMetrics.avgIterationsToPass.toFixed(1)}</p>
              </div>
              <div className="bg-[#0a0a1a] rounded p-2 text-center">
                <p className="text-[9px] text-[#546e7a] uppercase">Active</p>
                <p className={`text-[16px] font-mono font-bold ${qualityMetrics.activeGates > 0 ? 'text-[#ef5350]' : 'text-[#546e7a]'}`}>
                  {qualityMetrics.activeGates}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fail Reasons Chart */}
        {failHistData.length > 0 && (
          <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-4">
            <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">Fail Reasons</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={failHistData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: '#546e7a' }} />
                <YAxis dataKey="reason" type="category" tick={{ fontSize: 9, fill: '#546e7a' }} width={80} />
                <Tooltip contentStyle={{ background: '#0d0d20', border: '1px solid #1a1a3e', fontSize: 11 }} />
                <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                  {failHistData.map((_, i) => (
                    <Cell key={i} fill={`hsl(${4 + i * 5}, 70%, ${55 - i * 3}%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Violations */}
        <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-4">
          <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">
            Violations <span className="text-[#ef5350]">({violations.length})</span>
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {violations.length === 0 ? (
              <p className="text-[11px] text-[#546e7a]">No violations recorded</p>
            ) : (
              violations.slice().reverse().map((v, i) => (
                <div key={i} className="flex items-start gap-2 py-1 border-b border-[#1a1a3e]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef5350] mt-1 shrink-0" />
                  <div>
                    <p className="text-[10px] text-[#ef5350]">{v.type}</p>
                    <p className="text-[9px] text-[#546e7a]">{new Date(v.ts).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gate Log */}
      <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1a1a3e]">
          <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest">Ralph Gate Log (last 50 entries)</p>
        </div>
        <div className="max-h-48 overflow-y-auto font-mono text-[10px] p-3 space-y-0.5">
          {logLines.length === 0 ? (
            <p className="text-[#546e7a]">No log entries</p>
          ) : (
            logLines.slice().reverse().map((line, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[#2a2a4e] shrink-0">{line.timestamp.slice(0, 19)}</span>
                <span style={{ color: LOG_TYPE_COLORS[line.type] ?? '#546e7a' }}>{line.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {disarmTarget && <ManualDisarmModal wrId={disarmTarget} onClose={onDisarmClose} />}
    </div>
  );
}
