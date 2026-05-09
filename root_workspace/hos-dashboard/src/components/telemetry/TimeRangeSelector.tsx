export type TimeRange = '1h' | '6h' | '24h' | '7d';

const OPTIONS: TimeRange[] = ['1h', '6h', '24h', '7d'];

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Time range">
      {OPTIONS.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={`px-3 py-1 rounded text-[11px] transition-colors ${
            value === r
              ? 'bg-[#4fc3f722] border border-[#4fc3f744] text-[#4fc3f7]'
              : 'text-[#546e7a] hover:text-[#c8d6e5]'
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
