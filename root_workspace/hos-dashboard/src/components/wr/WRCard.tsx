import type { WorkRequest } from '../../types';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#546e7a',
  FRONT_DOOR: '#4fc3f7',
  ASSIGNED: '#26c6da',
  IN_PROGRESS: '#4fc3f7',
  VERIFICATION: '#ffb300',
  PASSED: '#66bb6a',
  FAILED: '#ef5350',
};

const PRIORITY_COLORS: Record<number, string> = {
  1: '#ef5350',
  2: '#ffb300',
  3: '#4fc3f7',
  4: '#546e7a',
  5: '#37474f',
};

interface Props {
  wr: WorkRequest;
  onClick: () => void;
}

export function WRCard({ wr, onClick }: Props) {
  const isArmed = wr.gateState === 'ARMED';

  return (
    <div
      onClick={onClick}
      className={`
        cursor-pointer rounded border bg-[#0d0d20] p-3 mb-2 transition-all duration-150
        hover:border-[#4fc3f744] hover:bg-[#12122a]
        ${isArmed ? 'gate-armed border-[#ef535066]' : 'border-[#1a1a3e]'}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] text-[#546e7a] font-mono">{wr.id}</span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ color: PRIORITY_COLORS[wr.priority], background: `${PRIORITY_COLORS[wr.priority]}22` }}
        >
          P{wr.priority}
        </span>
      </div>

      <p className="text-[12px] text-[#c8d6e5] font-medium leading-tight mb-2 line-clamp-2">{wr.title}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[wr.status] ?? '#546e7a' }}
          />
          <span className="text-[10px] text-[#546e7a] uppercase">{wr.type}</span>
        </div>
        <div className="flex items-center gap-2">
          {wr.gateIterations > 0 && (
            <span className="text-[10px] text-[#ffb300]">⟳ {wr.gateIterations}</span>
          )}
          {wr.assignedAgent && (
            <span className="text-[10px] text-[#4fc3f7] uppercase">{wr.assignedAgent}</span>
          )}
        </div>
      </div>
    </div>
  );
}
