import { useHOSStore } from '../../store/hosStore';

function Bar({ label, value, max = 100, warn = 75, crit = 90 }: {
  label: string; value: number; max?: number; warn?: number; crit?: number;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const color = value >= crit ? '#ef5350' : value >= warn ? '#ffb300' : '#4fc3f7';
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-[#546e7a] uppercase tracking-wider">{label}</span>
        <span className="text-[11px] font-mono" style={{ color }}>{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-[#1a1a3e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0a0a1a] rounded p-2">
      <p className="text-[9px] text-[#546e7a] uppercase">{label}</p>
      <p className="text-[12px] text-[#c8d6e5] font-mono mt-0.5">{value}</p>
    </div>
  );
}

export function VPSHealthPanel() {
  const m = useHOSStore((s) => s.vpsMetrics);

  return (
    <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3 h-full">
      <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">VPS Health</p>
      {m ? (
        <>
          <Bar label="CPU" value={m.cpuPercent} />
          <Bar label="RAM" value={m.ramPercent} warn={70} crit={85} />
          <Bar label="Disk" value={m.diskPercent} warn={80} crit={90} />
          <div className="grid grid-cols-2 gap-1.5 mt-3">
            <Stat label="RAM" value={`${m.ramUsedGB.toFixed(1)}/${m.ramTotalGB.toFixed(0)} GB`} />
            <Stat label="Uptime" value={`load ${(m.loadAvg[0] ?? 0).toFixed(2)}`} />
            <Stat label="Net ↓" value={`${(m.netInMBps * 1000).toFixed(0)} KB/s`} />
            <Stat label="Net ↑" value={`${(m.netOutMBps * 1000).toFixed(0)} KB/s`} />
          </div>
        </>
      ) : (
        <p className="text-[11px] text-[#546e7a]">Connecting...</p>
      )}
    </div>
  );
}
