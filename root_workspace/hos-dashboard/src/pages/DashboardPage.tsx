import { useHOSStore } from '../store/hosStore';
import { PipelineCanvas3D } from '../components/pipeline/PipelineCanvas3D';
import { PipelineErrorBoundary } from '../components/pipeline/PipelineErrorBoundary';
import { VPSHealthPanel } from '../components/telemetry/VPSHealthPanel';
import { PipelineThroughputPanel } from '../components/telemetry/PipelineThroughputPanel';
import { AgentStatusGrid } from '../components/telemetry/AgentStatusGrid';
import { QualityMetricsPanel } from '../components/telemetry/QualityMetricsPanel';
import { QuotaBurnMeter } from '../components/telemetry/QuotaBurnMeter';

const PRIORITY_COLOR: Record<number, string> = {
  1: '#ef5350', 2: '#ffb300', 3: '#4fc3f7', 4: '#546e7a', 5: '#37474f',
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#37474f', FRONT_DOOR: '#26c6da', ASSIGNED: '#4fc3f7',
  IN_PROGRESS: '#4fc3f7', VERIFICATION: '#ffb300', PASSED: '#66bb6a', FAILED: '#ef5350',
};

export function DashboardPage() {
  const workRequests = useHOSStore((s) => s.workRequests);
  const setPage = useHOSStore((s) => s.setPage);
  const selectWR = useHOSStore((s) => s.selectWR);

  const active = workRequests.filter(
    (w) => w.status === 'IN_PROGRESS' || w.status === 'VERIFICATION'
  );
  const armed = workRequests.filter((w) => w.gateState === 'ARMED');

  return (
    <div className="flex flex-col h-full overflow-auto p-4 space-y-3">
      {/* 3D Pipeline Canvas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest">Delivery Pipeline — 3D View</p>
          <p className="text-[10px] text-[#546e7a]">Drag to orbit · Scroll to zoom</p>
        </div>
        <PipelineErrorBoundary>
          <PipelineCanvas3D height={300} />
        </PipelineErrorBoundary>
      </div>

      {/* Telemetry Rail */}
      <div className="grid grid-cols-5 gap-3" style={{ minHeight: 170 }}>
        <VPSHealthPanel />
        <PipelineThroughputPanel />
        <AgentStatusGrid />
        <QualityMetricsPanel />
        <QuotaBurnMeter />
      </div>

      {/* Active WR Summary */}
      <div className="grid grid-cols-2 gap-3">
        {/* Active WRs */}
        <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest">Active Work Requests ({active.length})</p>
            <button onClick={() => setPage('work-requests')} className="text-[10px] text-[#546e7a] hover:text-[#4fc3f7]">
              View all →
            </button>
          </div>
          <div className="space-y-1.5">
            {active.length === 0 ? (
              <p className="text-[11px] text-[#546e7a]">No active WRs</p>
            ) : (
              active.slice(0, 5).map((wr) => (
                <div
                  key={wr.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-[#1a1a2e] rounded px-1 py-0.5"
                  onClick={() => { selectWR(wr); setPage('work-requests'); }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: STATUS_COLOR[wr.status] }}
                  />
                  <span className="text-[10px] text-[#546e7a] font-mono shrink-0">{wr.id.slice(-8)}</span>
                  <span className="text-[11px] text-[#c8d6e5] flex-1 truncate">{wr.title}</span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: PRIORITY_COLOR[wr.priority] }}>P{wr.priority}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Armed Gates */}
        <div className="bg-[#0d0d20] border border-[#1a1a3e] rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-[#ef5350] uppercase tracking-widest">Armed Gates ({armed.length})</p>
            <button onClick={() => setPage('quality-gates')} className="text-[10px] text-[#546e7a] hover:text-[#ef5350]">
              Manage →
            </button>
          </div>
          <div className="space-y-1.5">
            {armed.length === 0 ? (
              <p className="text-[11px] text-[#546e7a]">No gates armed</p>
            ) : (
              armed.map((wr) => {
                const lastVerdict = (wr.verdicts as { verdict: string; reason: string }[]).slice(-1)[0];
                return (
                  <div
                    key={wr.id}
                    className="flex items-start gap-2 gate-armed rounded p-1.5 cursor-pointer"
                    onClick={() => { selectWR(wr); setPage('work-requests'); }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ef5350] status-pulse mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-[#ef5350] truncate">{wr.title}</p>
                      {lastVerdict && (
                        <p className="text-[10px] text-[#546e7a] truncate">
                          {wr.gateIterations} iters · {lastVerdict.reason.slice(0, 40)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
