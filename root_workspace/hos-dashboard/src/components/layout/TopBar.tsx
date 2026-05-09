import { useHOSStore } from '../../store/hosStore';

export function TopBar() {
  const alerts = useHOSStore((s) => s.alerts);
  const wsConnected = useHOSStore((s) => s.wsConnected);
  const dismissAlert = useHOSStore((s) => s.dismissAlert);
  const quota = useHOSStore((s) => s.quotaMetrics);
  const globalGate = useHOSStore((s) => s.globalGateState);

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const quotaPercent = quota && quota.tokensDailyLimit > 0
    ? Math.round((quota.tokensUsedToday / quota.tokensDailyLimit) * 100)
    : 0;

  return (
    <header className="flex items-center justify-between px-4 h-10 border-b border-[#1a1a3e] bg-[#0a0a1a] shrink-0 z-50">
      <div className="flex items-center gap-3">
        <span className="text-[#4fc3f7] font-bold tracking-widest text-sm">HOS</span>
        <span className="text-[#546e7a] text-xs">HERMES OPERATING SYSTEM</span>
        {globalGate?.active && (
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#ef535022] border border-[#ef535044] text-[#ef5350] font-mono">
            GATE ARMED
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {criticalAlerts.length > 0 && (
          <div className="flex items-center gap-2">
            {criticalAlerts.slice(-3).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#ef535022] border border-[#ef535044] text-[#ef5350] text-[11px] gate-armed cursor-pointer"
                onClick={() => dismissAlert(a.id)}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ef5350] status-pulse" />
                {a.message}
              </div>
            ))}
          </div>
        )}

        {quota && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#546e7a]">QUOTA</span>
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 rounded-full bg-[#1a1a3e] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(quotaPercent, 100)}%`,
                    backgroundColor: quotaPercent > 80 ? '#ef5350' : quotaPercent > 60 ? '#ffb300' : '#4fc3f7',
                  }}
                />
              </div>
              <span className="text-[11px] text-[#c8d6e5]">{quotaPercent}%</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#66bb6a]' : 'bg-[#ef5350] status-pulse'}`}
          />
          <span className="text-[11px] text-[#546e7a]">{wsConnected ? 'LIVE' : 'OFFLINE'}</span>
        </div>
      </div>
    </header>
  );
}
