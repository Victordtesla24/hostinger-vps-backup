import { useHOSStore } from '../../store/hosStore';

export function QualityMetricsPanel() {
  const m = useHOSStore((s) => s.qualityMetrics);
  const wrs = useHOSStore((s) => s.workRequests);
  const armedCount = wrs.filter((w) => w.gateState === 'ARMED').length;

  return (
    <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3 h-full">
      <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest mb-3">Quality Gates</p>
      {m ? (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-[#546e7a]">Pass Rate</span>
              <span className="text-[11px] text-[#66bb6a] font-mono">{m.gatePassRatePercent}%</span>
            </div>
            <div className="h-1.5 bg-[#1a1a3e] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${m.gatePassRatePercent}%`,
                  backgroundColor: m.gatePassRatePercent > 80 ? '#66bb6a' : m.gatePassRatePercent > 60 ? '#ffb300' : '#ef5350',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Avg Iters', value: m.avgIterationsToPass.toFixed(1), color: '#4fc3f7' },
              { label: 'Active', value: armedCount.toString(), color: armedCount > 0 ? '#ef5350' : '#546e7a' },
              { label: 'Total', value: m.totalVerifications.toString(), color: '#546e7a' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#0a0a1a] rounded p-2 text-center">
                <p className="text-[9px] text-[#546e7a] uppercase">{label}</p>
                <p className="text-[14px] font-mono font-bold mt-0.5" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {Object.keys(m.failReasonsHistogram).length > 0 && (
            <div>
              <p className="text-[9px] text-[#546e7a] uppercase mb-1.5">Top Fail Reasons</p>
              {Object.entries(m.failReasonsHistogram)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([reason, count]) => (
                  <div key={reason} className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1 bg-[#1a1a3e] rounded-full overflow-hidden">
                      <div className="h-full bg-[#ef535066] rounded-full" style={{ width: `${Math.min(count * 20, 100)}%` }} />
                    </div>
                    <span className="text-[9px] text-[#546e7a] truncate w-24">{reason}</span>
                    <span className="text-[10px] text-[#ef5350] w-4 text-right">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-[#546e7a]">Connecting...</p>
      )}
    </div>
  );
}
