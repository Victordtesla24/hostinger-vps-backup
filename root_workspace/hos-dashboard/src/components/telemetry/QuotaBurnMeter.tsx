import { useHOSStore } from '../../store/hosStore';

export function QuotaBurnMeter() {
  const m = useHOSStore((s) => s.quotaMetrics);
  if (!m) return null;

  const pct = m.tokensDailyLimit > 0
    ? Math.round((m.tokensUsedToday / m.tokensDailyLimit) * 100)
    : 0;
  const color = pct > 80 ? '#ef5350' : pct > 60 ? '#ffb300' : '#4fc3f7';

  function fmt(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
    return n.toString();
  }

  return (
    <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3 h-full">
      <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">Anthropic Quota</p>
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-[#546e7a]">{fmt(m.tokensUsedToday)} / {fmt(m.tokensDailyLimit)}</span>
          <span className="text-[11px] font-mono" style={{ color }}>{pct}%</span>
        </div>
        <div className="h-2 bg-[#1a1a3e] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-[#0a0a1a] rounded p-2">
          <p className="text-[9px] text-[#546e7a] uppercase">Burn Rate</p>
          <p className="text-[12px] font-mono text-[#c8d6e5] mt-0.5">{fmt(m.burnRatePerHour)}/hr</p>
        </div>
        <div className="bg-[#0a0a1a] rounded p-2">
          <p className="text-[9px] text-[#546e7a] uppercase">Exhaustion</p>
          <p className="text-[12px] font-mono mt-0.5" style={{ color: m.projectedExhaustionHours !== null && m.projectedExhaustionHours < 2 ? '#ef5350' : '#c8d6e5' }}>
            {m.projectedExhaustionHours !== null ? `${m.projectedExhaustionHours.toFixed(1)}h` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
