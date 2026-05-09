import { useHOSStore } from '../../store/hosStore';
import { STAGE_DEFS } from './PipelineCanvas3D';

const STAGE_COLOR: Record<string, string> = {
  FRONT_DOOR:  '#26c6da',
  ASSIGNED:    '#4fc3f7',
  IN_PROGRESS: '#4fc3f7',
  VERIFICATION:'#ffb300',
  PASSED:      '#66bb6a',
};

export function PipelineFallback2D({ height = 300 }: { height?: number }) {
  const workRequests = useHOSStore((s) => s.workRequests);
  const activeWRs = workRequests.filter(
    (w) => w.status !== 'DRAFT' && w.status !== 'FAILED'
  );

  return (
    <div
      className="w-full bg-[#05050f] rounded border border-[#1a1a3e] overflow-hidden flex flex-col"
      style={{ height }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a1a3e]">
        <p className="text-[10px] text-[#4fc3f7] uppercase tracking-widest">Delivery Pipeline — 2D View</p>
        <p className="text-[9px] text-[#546e7a]">3D renderer unavailable</p>
      </div>

      {/* Stage columns */}
      <div className="flex flex-1 divide-x divide-[#1a1a3e] overflow-hidden">
        {STAGE_DEFS.map((stage) => {
          const stageWRs = activeWRs.filter((w) => w.status === stage.status);
          const color = STAGE_COLOR[stage.status] ?? '#546e7a';

          return (
            <div key={stage.status} className="flex-1 flex flex-col overflow-hidden min-w-0">
              {/* Stage header */}
              <div className="px-2 py-1.5 border-b" style={{ borderBottomColor: color + '44' }}>
                <p className="text-[9px] uppercase tracking-widest truncate" style={{ color }}>
                  {stage.label}
                </p>
                <p className="text-[13px] font-bold leading-none mt-0.5" style={{ color }}>
                  {stageWRs.length}
                </p>
              </div>

              {/* WR list for this stage */}
              <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-1">
                {stageWRs.length === 0 ? (
                  <p className="text-[9px] text-[#37474f] px-0.5">—</p>
                ) : (
                  stageWRs.slice(0, 6).map((wr) => (
                    <div
                      key={wr.id}
                      className="flex items-center gap-1 rounded px-1 py-0.5 bg-[#0d0d20]"
                    >
                      <span
                        className="w-1 h-1 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[9px] text-[#c8d6e5] truncate">{wr.title}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
