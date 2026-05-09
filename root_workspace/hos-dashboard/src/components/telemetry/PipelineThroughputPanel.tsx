import { useHOSStore } from '../../store/hosStore';

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#0a0a1a] rounded p-2.5">
      <p className="text-[9px] text-[#546e7a] uppercase tracking-wider">{label}</p>
      <p className="text-[16px] text-[#4fc3f7] font-mono font-bold mt-1">{value}</p>
      {sub && <p className="text-[10px] text-[#546e7a] mt-0.5">{sub}</p>}
    </div>
  );
}

export function PipelineThroughputPanel() {
  const m = useHOSStore((s) => s.pipelineMetrics);

  return (
    <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3 h-full">
      <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">Pipeline Throughput</p>
      {m ? (
        <>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            <Metric label="WRs/hr" value={m.wrCompletedPerHour.toString()} />
            <Metric label="Avg Cycle" value={`${m.avgCycleTimeMinutes}m`} />
            <Metric label="P50" value={`${m.p50CycleTimeMinutes}m`} />
            <Metric label="P95" value={`${m.p95CycleTimeMinutes}m`} />
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Active', value: m.activeWRs, color: '#4fc3f7' },
              { label: 'Queued', value: m.queuedWRs, color: '#26c6da' },
              { label: 'Stalled', value: m.stalledWRs, color: '#ffb300' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[11px] text-[#546e7a]">{label}</span>
                <span className="text-[12px] font-mono font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-[#546e7a]">Connecting...</p>
      )}
    </div>
  );
}
